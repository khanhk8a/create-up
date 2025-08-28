// server.js - Express Server với content-based image management
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');

const app = express();
app.use(express.json());
// Enable CORS
app.use(cors());

// Tạo các thư mục cần thiết
const TEMP_DIR = './uploads/temp';
const PERMANENT_DIR = './uploads/permanent';

async function ensureDirectories() {
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.mkdir(PERMANENT_DIR, { recursive: true });
}

// Cấu hình Multer cho upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR); // Upload vào thư mục temp trước
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh!'));
    }
  }
});

// Mock database
let posts = [];
let tempFiles = new Map(); // Track temporary files với timestamp

// Utility function: Extract image filenames from content
function extractImageFilenames(content) {
  const imageRegex = /\/uploads\/(temp|permanent)\/([^"'\s>]+)/g;
  const filenames = [];
  let match;
  
  while ((match = imageRegex.exec(content)) !== null) {
    filenames.push(match[2]); // match[2] là filename
  }
  
  return [...new Set(filenames)]; // Remove duplicates
}

// Utility function: Move images from temp to permanent
async function moveImagesToPermanent(filenames) {
  const movedImages = [];
  
  for (const filename of filenames) {
    const tempPath = path.join(TEMP_DIR, filename);
    const permanentPath = path.join(PERMANENT_DIR, filename);
    
    try {
      // Check if file exists in temp
      await fs.access(tempPath);
      await fs.rename(tempPath, permanentPath);
      tempFiles.delete(filename);
      movedImages.push(filename);
    } catch (error) {
      console.error(`Không thể chuyển file ${filename}:`, error.message);
    }
  }
  
  return movedImages;
}

// Utility function: Update content URLs from temp to permanent
function updateContentUrls(content) {
  return content.replace(/\/uploads\/temp\//g, '/uploads/permanent/');
}

// API: Upload ảnh tạm thời cho editor
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Không có file được upload' });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
      uploadTime: Date.now()
    };

    // Track temp file
    tempFiles.set(req.file.filename, fileInfo);

    res.json({
      success: true,
      filename: req.file.filename,
      url: `/uploads/temp/${req.file.filename}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Tạo bài viết
app.post('/api/posts', async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Title và content là bắt buộc' });
    }

    // Extract image filenames from content
    const imageFilenames = extractImageFilenames(content);
    
    // Move images from temp to permanent
    const movedImages = await moveImagesToPermanent(imageFilenames);
    
    // Update content URLs
    const updatedContent = updateContentUrls(content);

    const post = {
      id: uuidv4(),
      title,
      content: updatedContent,
      images: movedImages, // Store list of image filenames for cleanup
      createdAt: new Date().toISOString()
    };

    posts.push(post);
    console.log(`✅ Tạo bài viết mới với ${movedImages.length} ảnh`);
    
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Cập nhật bài viết
app.put('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    const postIndex = posts.findIndex(p => p.id === id);
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    }

    const post = posts[postIndex];
    const oldImages = post.images || [];

    // Extract new image filenames from updated content
    const newImageFilenames = extractImageFilenames(content);
    
    // Move new temp images to permanent
    const movedImages = await moveImagesToPermanent(newImageFilenames);
    
    // Find images that are no longer used
    const currentImages = extractImageFilenames(updateContentUrls(content));
    const unusedImages = oldImages.filter(img => !currentImages.includes(img));
    
    // Delete unused images
    for (const filename of unusedImages) {
      try {
        await fs.unlink(path.join(PERMANENT_DIR, filename));
        console.log(`🗑️ Xóa ảnh không sử dụng: ${filename}`);
      } catch (error) {
        console.error(`Không thể xóa file ${filename}:`, error.message);
      }
    }

    // Update post
    post.title = title;
    post.content = updateContentUrls(content);
    post.images = currentImages;
    post.updatedAt = new Date().toISOString();

    console.log(`✅ Cập nhật bài viết - Thêm: ${movedImages.length}, Xóa: ${unusedImages.length}`);
    
    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Xóa bài viết
app.delete('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const postIndex = posts.findIndex(p => p.id === id);
    
    if (postIndex === -1) {
      return res.status(404).json({ error: 'Không tìm thấy bài viết' });
    }

    const post = posts[postIndex];

    // Delete all images in the post
    if (post.images && post.images.length > 0) {
      for (const filename of post.images) {
        try {
          await fs.unlink(path.join(PERMANENT_DIR, filename));
          console.log(`🗑️ Xóa ảnh: ${filename}`);
        } catch (error) {
          console.error(`Không thể xóa file ${filename}:`, error.message);
        }
      }
    }

    posts.splice(postIndex, 1);
    console.log(`✅ Xóa bài viết và ${post.images?.length || 0} ảnh`);
    
    res.json({ success: true, message: 'Đã xóa bài viết và ảnh' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API: Lấy danh sách bài viết
app.get('/api/posts', (req, res) => {
  res.json({ posts });
});

// API: Lấy chi tiết bài viết
app.get('/api/posts/:id', (req, res) => {
  const post = posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Không tìm thấy bài viết' });
  }
  res.json({ post });
});

// Serve static files
app.use('/uploads', express.static('uploads'));

// Cleanup Job 1: Xóa file tạm thời cũ (chạy mỗi 30 phút)
cron.schedule('*/30 * * * *', async () => {
  console.log('🧹 Đang dọn dẹp file tạm thời...');
  
  const now = Date.now();
  const twoHours = 2 * 60 * 60 * 1000; // 2 giờ
  let deletedCount = 0;
  
  for (const [filename, fileInfo] of tempFiles.entries()) {
    if (now - fileInfo.uploadTime > twoHours) {
      try {
        await fs.unlink(fileInfo.path);
        tempFiles.delete(filename);
        deletedCount++;
        console.log(`✅ Xóa file tạm thời cũ: ${filename}`);
      } catch (error) {
        console.error(`❌ Không thể xóa file ${filename}:`, error.message);
      }
    }
  }
  
  console.log(`🎉 Dọn dẹp xong - Đã xóa ${deletedCount} file tạm thời`);
});

// Cleanup Job 2: Xóa orphaned files trong permanent (chạy mỗi ngày lúc 3AM)
cron.schedule('0 3 * * *', async () => {
  console.log('🧹 Đang kiểm tra orphaned files trong permanent...');
  
  try {
    // Get all files in permanent directory
    const permanentFiles = await fs.readdir(PERMANENT_DIR);
    
    // Get all image filenames used in posts
    const usedImages = new Set();
    posts.forEach(post => {
      if (post.images) {
        post.images.forEach(img => usedImages.add(img));
      }
      
      // Also extract from content as backup
      const contentImages = extractImageFilenames(post.content);
      contentImages.forEach(img => usedImages.add(img));
    });
    
    let deletedCount = 0;
    
    // Delete unused files
    for (const filename of permanentFiles) {
      if (!usedImages.has(filename)) {
        try {
          await fs.unlink(path.join(PERMANENT_DIR, filename));
          deletedCount++;
          console.log(`✅ Xóa orphaned file: ${filename}`);
        } catch (error) {
          console.error(`❌ Không thể xóa file ${filename}:`, error.message);
        }
      }
    }
    
    console.log(`🎉 Dọn dẹp orphaned files xong - Đã xóa ${deletedCount} file`);
    
  } catch (error) {
    console.error('❌ Lỗi khi dọn dẹp orphaned files:', error);
  }
});

// Cleanup Job 3: Sync image list in posts (chạy mỗi tuần)
cron.schedule('0 4 * * 0', async () => {
  console.log('🔄 Đang sync danh sách ảnh trong posts...');
  
  let updatedCount = 0;
  
  posts.forEach(post => {
    const contentImages = extractImageFilenames(post.content);
    
    // Update images array to match content
    if (JSON.stringify(post.images?.sort()) !== JSON.stringify(contentImages.sort())) {
      post.images = contentImages;
      updatedCount++;
      console.log(`✅ Sync ảnh cho bài viết: ${post.title}`);
    }
  });
  
  console.log(`🎉 Sync xong - Cập nhật ${updatedCount} bài viết`);
});

// API: Get cleanup stats (for monitoring)
app.get('/api/cleanup-stats', async (req, res) => {
  try {
    const tempFiles = await fs.readdir(TEMP_DIR);
    const permanentFiles = await fs.readdir(PERMANENT_DIR);
    
    const usedImages = new Set();
    posts.forEach(post => {
      if (post.images) {
        post.images.forEach(img => usedImages.add(img));
      }
    });
    
    const orphanedCount = permanentFiles.filter(file => !usedImages.has(file)).length;
    
    res.json({
      tempFiles: tempFiles.length,
      permanentFiles: permanentFiles.length,
      orphanedFiles: orphanedCount,
      totalPosts: posts.length,
      totalUsedImages: usedImages.size
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Khởi tạo server
async function startServer() {
  await ensureDirectories();
  
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
    console.log('📁 Thư mục temp:', TEMP_DIR);
    console.log('📁 Thư mục permanent:', PERMANENT_DIR);
    console.log('📊 Cleanup stats: GET /api/cleanup-stats');
  });
}

startServer().catch(console.error);