import React, { useState, useMemo } from 'react';

/**
 * MediaVaultModal Component
 * Aggregates all shared images, attachments, and voice memos in a room into
 * an organized, searchable gallery with instant previews and download capabilities.
 */
const MediaVaultModal = ({ isOpen, onClose, messages, selectedUser }) => {
  const [activeFilter, setActiveFilter] = useState('all');

  const vaultItems = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const items = [];
    messages.forEach((msg) => {
      if (msg.deleted) return;

      const senderName = typeof msg.senderId === 'object' ? msg.senderId.fullname : 'Someone';
      const senderAvatar = typeof msg.senderId === 'object' ? msg.senderId.profilePic : null;

      // 1. Image items
      if (msg.image) {
        items.push({
          id: msg._id,
          type: 'image',
          url: msg.image,
          title: 'Shared Photo',
          sender: senderName,
          avatar: senderAvatar,
          date: msg.createdAt
        });
      }

      // 2. Code Snippets & Links
      if (
        msg.text &&
        (msg.text.includes('http') || msg.text.includes('```') || msg.text.includes('code'))
      ) {
        items.push({
          id: msg._id,
          type: 'link',
          title: msg.text,
          sender: senderName,
          avatar: senderAvatar,
          date: msg.createdAt
        });
      }
    });

    return items;
  }, [messages]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'all') return vaultItems;
    return vaultItems.filter((item) => item.type === activeFilter);
  }, [vaultItems, activeFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-[#E8E8E2] w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#1A1A1A]">
        {/* Header */}
        <div className="bg-[#1C2B3A] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📁</span>
            <div>
              <h3 className="font-bold text-base font-headline">Media & File Vault</h3>
              <p className="text-xs text-blue-200/80">
                {selectedUser ? (selectedUser.isGroup ? selectedUser.groupName : selectedUser.fullname) : 'Room'} Assets & Attachments
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-all text-lg cursor-pointer p-1 rounded-lg hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Filter Navigation */}
        <div className="flex border-b border-[#E8E8E2] bg-[#F8F8F5] px-6">
          <button
            onClick={() => setActiveFilter('all')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'border-[#1C2B3A] text-[#1C2B3A] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#1A1A1A]'
            }`}
          >
            All Items ({vaultItems.length})
          </button>
          <button
            onClick={() => setActiveFilter('image')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeFilter === 'image'
                ? 'border-[#1C2B3A] text-[#1C2B3A] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#1A1A1A]'
            }`}
          >
            🖼️ Photos ({vaultItems.filter((i) => i.type === 'image').length})
          </button>
          <button
            onClick={() => setActiveFilter('link')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeFilter === 'link'
                ? 'border-[#1C2B3A] text-[#1C2B3A] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#1A1A1A]'
            }`}
          >
            🔗 Links & Snippets ({vaultItems.filter((i) => i.type === 'link').length})
          </button>
        </div>

        {/* Items Grid / List */}
        <div className="p-6 overflow-y-auto flex-1 bg-[#FAFAFA]">
          {filteredItems.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] italic text-center py-12">No media items found matching selected filter.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white border border-[#E8E8E2] rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  {item.type === 'image' ? (
                    <div className="h-32 w-full bg-gray-100 overflow-hidden relative group">
                      <img src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <a
                        href={item.url}
                        download="shared_photo.png"
                        className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Download"
                      >
                        ⬇️
                      </a>
                    </div>
                  ) : (
                    <div className="p-4 bg-blue-50/50 flex flex-col gap-2 border-b border-[#E8E8E2]">
                      <span className="text-xl text-blue-500">🔗</span>
                      <p className="text-xs text-[#1A1A1A] line-clamp-2 font-mono">{item.title}</p>
                    </div>
                  )}

                  <div className="p-3 bg-white flex items-center justify-between text-[11px] text-[#6B7280]">
                    <span className="font-semibold text-[#1C2B3A]">{item.sender}</span>
                    <span>{new Date(item.date).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#E8E8E2] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#1C2B3A] hover:bg-[#253545] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow transition-all cursor-pointer"
          >
            Close Vault
          </button>
        </div>
      </div>
    </div>
  );
};

export default MediaVaultModal;
