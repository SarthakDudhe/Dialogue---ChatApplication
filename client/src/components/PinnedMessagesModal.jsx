import React from 'react';

/**
 * PinnedMessagesModal Component
 * Displays a persistent vault of pinned messages for the active conversation
 * with 1-click jump-to-message navigation and unpin capabilities.
 */
const PinnedMessagesModal = ({ isOpen, onClose, pinnedMessages, onUnpinMessage, onJumpToMessage, getSenderName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-[#E8E8E2] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] text-[#1A1A1A]">
        {/* Header */}
        <div className="bg-[#1C2B3A] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📌</span>
            <div>
              <h3 className="font-bold text-base font-headline">Pinned & Bookmarked Messages</h3>
              <p className="text-xs text-blue-200/80">Key announcements, links, and guidelines for this channel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-all text-lg cursor-pointer p-1 rounded-lg hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-[#FAFAFA]">
          {pinnedMessages.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] italic text-center py-12">No pinned messages in this chat room yet.</p>
          ) : (
            pinnedMessages.map((msg) => (
              <div
                key={msg._id}
                className="bg-white border border-[#E8E8E2] p-4 rounded-xl shadow-sm hover:border-[#1C2B3A]/30 transition-all flex items-start justify-between gap-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold text-[#1C2B3A] bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">
                      {getSenderName(msg.senderId)}
                    </span>
                    <span className="text-[10px] text-[#9CA3AF]">
                      {new Date(msg.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs text-[#1A1A1A] leading-relaxed break-words">
                    {msg.image ? '🖼️ [Photo Attachment]' : msg.text}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => {
                      onJumpToMessage(msg._id);
                      onClose();
                    }}
                    className="text-[11px] font-semibold text-[#1C2B3A] bg-[#F0F4F8] hover:bg-[#1C2B3A] hover:text-white px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                  >
                    Jump ➔
                  </button>
                  <button
                    onClick={() => onUnpinMessage(msg._id)}
                    className="text-xs text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-gray-100 transition-all cursor-pointer"
                    title="Unpin Message"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#E8E8E2] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#1C2B3A] hover:bg-[#253545] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow transition-all cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinnedMessagesModal;
