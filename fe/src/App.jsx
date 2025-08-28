import React, { useState, useEffect, useRef } from 'react';
import { Upload, Save, Trash2, Edit, Plus, Image, Eye } from 'lucide-react';

const API_BASE = 'http://localhost:3001/api';

// Rich Text Editor Component với image upload
const RichTextEditor = ({ value, onChange, disabled }) => {
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // Insert image vào cursor position
  const insertImageAtCursor = (imageUrl) => {
    const editor = editorRef.current;
    if (!editor) return;

    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.margin = '10px 0';
    img.style.display = 'block';
    
    range.deleteContents();
    range.insertNode(img);
    
    // Move cursor after image
    range.setStartAfter(img);
    range.setEndAfter(img);
    selection.removeAllRanges();
    selection.addRange(range);

    // Trigger onChange
    onChange(editor.innerHTML);
  };

  // Handle paste để tự động upload ảnh
  const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    
    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      await uploadImage(file);
    }
  };

  // Upload ảnh
  const uploadImage = async (file) => {
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        insertImageAtCursor(result.url);
      } else {
        alert('Lỗi upload: ' + result.error);
      }
    } catch (error) {
      alert('Lỗi upload: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      uploadImage(file);
      e.target.value = ''; // Reset input
    }
  };

  const handleEditorChange = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  // Toolbar functions
  const formatText = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current.focus();
    handleEditorChange();
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <h1 className="text-red-500">Test Tailwind CSS</h1>
      {/* Toolbar */}
      <div className="bg-gray-50 p-2 border-b flex gap-2 flex-wrap items-center">
        <button
          type="button"
          onClick={() => formatText('bold')}
          className="px-3 py-1 bg-white border rounded hover:bg-gray-100"
          disabled={disabled}
        >
          <strong>B</strong>
        </button>
        
        <button
          type="button"
          onClick={() => formatText('italic')}
          className="px-3 py-1 bg-white border rounded hover:bg-gray-100"
          disabled={disabled}
        >
          <em>I</em>
        </button>
        
        <button
          type="button"
          onClick={() => formatText('underline')}
          className="px-3 py-1 bg-white border rounded hover:bg-gray-100"
          disabled={disabled}
        >
          <u>U</u>
        </button>
        
        <div className="w-px h-6 bg-gray-300"></div>
        
        <button
          type="button"
          onClick={() => formatText('formatBlock', 'h2')}
          className="px-3 py-1 bg-white border rounded hover:bg-gray-100 text-sm"
          disabled={disabled}
        >
          H2
        </button>
        
        <button
          type="button"
          onClick={() => formatText('formatBlock', 'h3')}
          className="px-3 py-1 bg-white border rounded hover:bg-gray-100 text-sm"
          disabled={disabled}
        >
          H3
        </button>
        
        <button
          type="button"
          onClick={() => formatText('insertUnorderedList')}
          className="px-3 py-1 bg-white border rounded hover:bg-gray-100 text-sm"
          disabled={disabled}
        >
          • List
        </button>
        
        <div className="w-px h-6 bg-gray-300"></div>
        
        {/* Image upload button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="flex items-center gap-1 px-3 py-1 bg-white border rounded hover:bg-gray-100 disabled:opacity-50"
        >
          <Image className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Ảnh'}
        </button>
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable={!disabled}
        onInput={handleEditorChange}
        onPaste={handlePaste}
        dangerouslySetInnerHTML={{ __html: value }}
        className="p-4 min-h-[300px] focus:outline-none"
        style={{ 
          fontSize: '14px', 
          lineHeight: '1.6',
          color: disabled ? '#6b7280' : '#000'
        }}
        placeholder="Nhập nội dung bài viết... Bạn có thể paste ảnh trực tiếp hoặc dùng nút Ảnh ở toolbar."
      />
      
      {uploading && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm">Đang upload ảnh...</p>
          </div>
        </div>
      )}
    </div>
  );
};

// Component form tạo/sửa bài viết
const PostForm = ({ post, onSave, onCancel }) => {
  const [title, setTitle] = useState(post?.title || '');
  const [content, setContent] = useState(post?.content || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      alert('Vui lòng nhập tiêu đề');
      return;
    }

    if (!content.trim() || content.trim() === '<br>') {
      alert('Vui lòng nhập nội dung');
      return;
    }

    setSaving(true);
    try {
      const postData = { title, content };

      const url = post 
        ? `${API_BASE}/posts/${post.id}` 
        : `${API_BASE}/posts`;
      
      const method = post ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(postData)
      });

      const result = await response.json();
      if (result.success) {
        onSave(result.post);
      } else {
        alert('Lỗi lưu bài viết: ' + result.error);
      }
    } catch (error) {
      alert('Lỗi: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-4">
        {post ? 'Sửa bài viết' : 'Tạo bài viết mới'}
      </h2>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Tiêu đề</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nhập tiêu đề bài viết..."
            disabled={saving}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Nội dung</label>
          <div className="relative">
            <RichTextEditor
              value={content}
              onChange={setContent}
              disabled={saving}
            />
          </div>
          <p className="text-sm text-gray-500 mt-2">
            💡 Tip: Bạn có thể paste ảnh trực tiếp vào editor (Ctrl+V) hoặc dùng nút "Ảnh" ở toolbar
          </p>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Đang lưu...' : 'Lưu bài viết'}
          </button>
          
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex items-center gap-2 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 disabled:opacity-50"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
};

// Component hiển thị bài viết
const PostItem = ({ post, onEdit, onDelete, onView }) => {
  const handleDelete = () => {
    if (window.confirm('Bạn có chắc muốn xóa bài viết này? Tất cả ảnh trong bài viết cũng sẽ bị xóa.')) {
      onDelete(post.id);
    }
  };

  // Tạo preview content (giới hạn độ dài)
  const getPreviewContent = (htmlContent) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    return textContent.length > 150 
      ? textContent.substring(0, 150) + '...' 
      : textContent;
  };

  const imageCount = post.images ? post.images.length : 0;

  return (
    <div className="bg-white p-6 rounded-lg shadow-lg">
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold">{post.title}</h3>
        <div className="flex gap-2">
          <button
            onClick={() => onView(post)}
            className="p-1 text-green-500 hover:bg-green-50 rounded"
            title="Xem chi tiết"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(post)}
            className="p-1 text-blue-500 hover:bg-blue-50 rounded"
            title="Sửa bài viết"
          >
            <Edit className="w-4 h-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-red-500 hover:bg-red-50 rounded"
            title="Xóa bài viết"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      <p className="text-gray-600 mb-4">{getPreviewContent(post.content)}</p>
      
      <div className="flex items-center justify-between text-sm text-gray-400">
        <div>
          <span>Tạo: {new Date(post.createdAt).toLocaleDateString('vi-VN')}</span>
          {post.updatedAt && (
            <span className="ml-3">Sửa: {new Date(post.updatedAt).toLocaleDateString('vi-VN')}</span>
          )}
        </div>
        
        {imageCount > 0 && (
          <div className="flex items-center gap-1">
            <Image className="w-4 h-4" />
            <span>{imageCount} ảnh</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Modal xem bài viết
const PostViewModal = ({ post, onClose }) => {
  if (!post) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">{post.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6">
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
          
          <div className="mt-6 pt-4 border-t text-sm text-gray-500">
            <p>Tạo lúc: {new Date(post.createdAt).toLocaleString('vi-VN')}</p>
            {post.updatedAt && (
              <p>Sửa lúc: {new Date(post.updatedAt).toLocaleString('vi-VN')}</p>
            )}
            {post.images && post.images.length > 0 && (
              <p>Có {post.images.length} hình ảnh trong bài viết</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Component chính
const PostManager = () => {
  const [posts, setPosts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingPost, setEditingPost] = useState(null);
  const [viewingPost, setViewingPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  // Load posts khi component mount
  useEffect(() => {
    loadPosts();
    loadStats();
  }, []);

  const loadPosts = async () => {
    try {
      const response = await fetch(`${API_BASE}/posts`);
      const result = await response.json();
      setPosts(result.posts || []);
    } catch (error) {
      console.error('Lỗi load posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/cleanup-stats`);
      const result = await response.json();
      setStats(result);
    } catch (error) {
      console.error('Lỗi load stats:', error);
    }
  };

  const handleCreateNew = () => {
    setEditingPost(null);
    setShowForm(true);
  };

  const handleEdit = (post) => {
    setEditingPost(post);
    setShowForm(true);
  };

  const handleView = (post) => {
    setViewingPost(post);
  };

  const handleSave = (savedPost) => {
    if (editingPost) {
      // Update existing post
      setPosts(prev => prev.map(p => 
        p.id === savedPost.id ? savedPost : p
      ));
    } else {
      // Add new post
      setPosts(prev => [savedPost, ...prev]);
    }
    
    setShowForm(false);
    setEditingPost(null);
    loadStats(); // Refresh stats
  };

  const handleDelete = async (postId) => {
    try {
      const response = await fetch(`${API_BASE}/posts/${postId}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      if (result.success) {
        setPosts(prev => prev.filter(p => p.id !== postId));
        loadStats(); // Refresh stats
      } else {
        alert('Lỗi xóa bài viết: ' + result.error);
      }
    } catch (error) {
      alert('Lỗi: ' + error.message);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingPost(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Quản lý bài viết</h1>
            {stats && (
              <div className="text-sm text-gray-600 mt-1">
                <span>📄 {posts.length} bài viết</span>
                <span className="ml-4">🖼️ {stats.totalUsedImages} ảnh</span>
                <span className="ml-4">⏳ {stats.tempFiles} file tạm thời</span>
                {stats.orphanedFiles > 0 && (
                  <span className="ml-4 text-orange-600">⚠️ {stats.orphanedFiles} file rác</span>
                )}
              </div>
            )}
          </div>
          {!showForm && (
            <button
              onClick={handleCreateNew}
              className="flex items-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              <Plus className="w-4 h-4" />
              Tạo bài viết mới
            </button>
          )}
        </div>

        {showForm ? (
          <PostForm
            post={editingPost}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        ) : (
          <div className="space-y-6">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 text-lg">Chưa có bài viết nào</p>
                <button
                  onClick={handleCreateNew}
                  className="mt-4 bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600"
                >
                  Tạo bài viết đầu tiên
                </button>
              </div>
            ) : (
              posts.map(post => (
                <PostItem
                  key={post.id}
                  post={post}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onView={handleView}
                />
              ))
            )}
          </div>
        )}

        {viewingPost && (
          <PostViewModal
            post={viewingPost}
            onClose={() => setViewingPost(null)}
          />
        )}
      </div>
    </div>
  );
};

export default PostManager;