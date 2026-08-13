import React, { useState, useEffect, useContext } from 'react';
import { ChatContext } from '../../context/ChatContext';
import toast from 'react-hot-toast';

/**
 * CommandPalette Component
 * Global Ctrl+K / Cmd+K Spotlight overlay for keyboard-driven navigation
 * and instant feature execution across Dialogue.
 */
const CommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const { users, conversations, setSelectedUser } = useContext(ChatContext);

  // Global keydown listener for Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setSearchQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Aggregate command items
  const commandItems = [
    {
      id: 'cmd-catchup',
      type: 'action',
      title: '⚡ Open AI Catch-Up Matrix',
      category: 'Intelligence',
      action: () => {
        toast.info("Click '⚡ AI Catch Up' header button in active chat!");
      }
    },
    {
      id: 'cmd-vault',
      type: 'action',
      title: '📁 Open Media & File Vault',
      category: 'Storage',
      action: () => {
        toast.info("Click '📁 Vault' header button in active chat!");
      }
    },
    {
      id: 'cmd-pinned',
      type: 'action',
      title: '📌 View Pinned & Bookmarked Messages',
      category: 'Bookmarks',
      action: () => {
        toast.info("Click '📌 Pinned' header button in active chat!");
      }
    },
    // User contacts
    ...users.map((u) => ({
      id: 'user-' + u._id,
      type: 'contact',
      title: `💬 Chat with ${u.fullname}`,
      category: 'Direct Messages',
      action: () => setSelectedUser(u)
    })),
    // Groups
    ...conversations.filter((c) => c.isGroup).map((g) => ({
      id: 'group-' + g._id,
      type: 'group',
      title: `👥 Channel: ${g.groupName}`,
      category: 'Group Channels',
      action: () => setSelectedUser(g)
    }))
  ];

  const filteredItems = commandItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (item) => {
    item.action();
    setIsOpen(false);
    setSearchQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 bg-black/65 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-[#1C2B3A] border border-white/20 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#FAFAFA] animate-fade-in-scale">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-[#111111]/80">
          <span className="text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a command or search contacts (Ctrl+K)..."
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-sm text-[#FAFAFA] placeholder-[#888]"
          />
          <kbd className="bg-white/10 text-gray-300 text-[10px] px-2 py-1 rounded font-mono border border-white/10">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1 bg-[#1A1A1A]">
          {filteredItems.length === 0 ? (
            <p className="text-xs text-[#888] italic text-center py-8">No matching commands found.</p>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`p-3 rounded-xl flex items-center justify-between transition-all cursor-pointer text-xs ${
                  idx === selectedIndex ? 'bg-[#2D4A6B] text-white' : 'hover:bg-white/5 text-[#DDD]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold">{item.title}</span>
                </div>
                <span className="text-[10px] text-gray-400 bg-white/5 px-2 py-0.5 rounded uppercase font-mono tracking-wider">
                  {item.category}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-[#111111] border-t border-white/10 flex items-center justify-between text-[11px] text-gray-400 px-4">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono text-gray-200">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-[9px] font-mono text-gray-200">ENTER</kbd> Select
            </span>
          </div>
          <span className="font-mono text-[10px] text-blue-300/80">Dialogue Spotlight</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
