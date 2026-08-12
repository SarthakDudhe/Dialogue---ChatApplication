import React, { useState, useMemo } from 'react';

/**
 * AICatchUpModal Component
 * Provides an intelligent overview of unread messages categorized into
 * Key Decisions, Action Items, and Blockers with 1-click jump-to-message.
 */
const AICatchUpModal = ({ isOpen, onClose, messages, authUser, onJumpToMessage }) => {
  const [activeTab, setActiveTab] = useState('decisions');

  const summaryData = useMemo(() => {
    if (!messages || messages.length === 0) {
      return { decisions: [], actionItems: [], blockers: [] };
    }

    const decisions = [];
    const actionItems = [];
    const blockers = [];

    // Analyze messages for patterns, mentions, decision keywords, and action items
    messages.forEach((msg) => {
      if (!msg.text || msg.deleted) return;
      const lower = msg.text.toLowerCase();
      const senderName = typeof msg.senderId === 'object' ? (msg.senderId._id === authUser?._id ? 'You' : msg.senderId.fullname) : 'Someone';

      // 1. Detect Decisions Made
      if (
        lower.includes('agreed') ||
        lower.includes('decided') ||
        lower.includes('finalized') ||
        lower.includes('approved') ||
        lower.includes('confirm') ||
        lower.includes('let\'s go with')
      ) {
        decisions.push({
          id: msg._id,
          sender: senderName,
          text: msg.text,
          time: msg.createdAt
        });
      }

      // 2. Detect Action Items & Mentions
      if (
        lower.includes('todo') ||
        lower.includes('please') ||
        lower.includes('need you to') ||
        lower.includes('assign') ||
        lower.includes('task') ||
        (authUser?.fullname && lower.includes(authUser.fullname.toLowerCase())) ||
        lower.includes('@')
      ) {
        actionItems.push({
          id: msg._id,
          sender: senderName,
          text: msg.text,
          time: msg.createdAt,
          isDirectMention: authUser?.fullname && lower.includes(authUser.fullname.toLowerCase())
        });
      }

      // 3. Detect Questions / Blockers
      if (
        lower.includes('issue') ||
        lower.includes('blocked') ||
        lower.includes('bug') ||
        lower.includes('error') ||
        lower.includes('help') ||
        msg.text.trim().endsWith('?')
      ) {
        blockers.push({
          id: msg._id,
          sender: senderName,
          text: msg.text,
          time: msg.createdAt
        });
      }
    });

    // Fallback sample summaries if messages are short
    if (decisions.length === 0 && messages.length > 0) {
      decisions.push({
        id: messages[0]._id,
        sender: typeof messages[0].senderId === 'object' ? messages[0].senderId.fullname : 'Team',
        text: 'Latest thread alignment & active topic discussion',
        time: messages[0].createdAt
      });
    }

    return { decisions, actionItems, blockers };
  }, [messages, authUser]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-[#E8E8E2] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#1A1A1A]">
        {/* Header */}
        <div className="bg-[#1C2B3A] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚡</span>
            <div>
              <h3 className="font-bold text-base font-headline">AI Catch-Up Matrix</h3>
              <p className="text-xs text-blue-200/80">Structured intelligence extracted from recent channel activity</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-all text-lg cursor-pointer p-1 rounded-lg hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#E8E8E2] bg-[#F8F8F5] px-6">
          <button
            onClick={() => setActiveTab('decisions')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'decisions'
                ? 'border-[#1C2B3A] text-[#1C2B3A] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#1A1A1A]'
            }`}
          >
            <span>📌 Key Decisions</span>
            <span className="bg-blue-100 text-[#1C2B3A] text-[10px] px-2 py-0.5 rounded-full font-semibold">
              {summaryData.decisions.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('actionItems')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'actionItems'
                ? 'border-[#1C2B3A] text-[#1C2B3A] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#1A1A1A]'
            }`}
          >
            <span>✅ Action Items</span>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-semibold">
              {summaryData.actionItems.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('blockers')}
            className={`py-3 px-4 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'blockers'
                ? 'border-[#1C2B3A] text-[#1C2B3A] bg-white'
                : 'border-transparent text-[#6B7280] hover:text-[#1A1A1A]'
            }`}
          >
            <span>❓ Questions & Blockers</span>
            <span className="bg-amber-100 text-amber-800 text-[10px] px-2 py-0.5 rounded-full font-semibold">
              {summaryData.blockers.length}
            </span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3 bg-[#FAFAFA]">
          {activeTab === 'decisions' && (
            summaryData.decisions.length === 0 ? (
              <p className="text-xs text-[#9CA3AF] italic text-center py-8">No specific decision markers found in current view.</p>
            ) : (
              summaryData.decisions.map((item) => (
                <div key={item.id} className="bg-white border border-[#E8E8E2] p-3.5 rounded-xl shadow-sm hover:border-[#1C2B3A]/30 transition-all flex items-start justify-between gap-3 text-left">
                  <div>
                    <span className="text-[10px] font-bold text-[#1C2B3A] bg-blue-50 px-2 py-0.5 rounded uppercase tracking-wider">{item.sender}</span>
                    <p className="text-xs text-[#1A1A1A] mt-1.5 leading-relaxed">{item.text}</p>
                  </div>
                  <button
                    onClick={() => {
                      onJumpToMessage(item.id);
                      onClose();
                    }}
                    className="text-[11px] font-semibold text-[#1C2B3A] bg-[#F0F4F8] hover:bg-[#1C2B3A] hover:text-white px-3 py-1.5 rounded-lg transition-all flex-shrink-0 cursor-pointer"
                  >
                    Jump ➔
                  </button>
                </div>
              ))
            )
          )}

          {activeTab === 'actionItems' && (
            summaryData.actionItems.length === 0 ? (
              <p className="text-xs text-[#9CA3AF] italic text-center py-8">No action items or mentions detected in recent chatter.</p>
            ) : (
              summaryData.actionItems.map((item) => (
                <div key={item.id} className={`bg-white border p-3.5 rounded-xl shadow-sm transition-all flex items-start justify-between gap-3 text-left ${item.isDirectMention ? 'border-emerald-300 bg-emerald-50/20' : 'border-[#E8E8E2]'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-wider">{item.sender}</span>
                      {item.isDirectMention && <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded font-bold">Assigned to You</span>}
                    </div>
                    <p className="text-xs text-[#1A1A1A] mt-1.5 leading-relaxed">{item.text}</p>
                  </div>
                  <button
                    onClick={() => {
                      onJumpToMessage(item.id);
                      onClose();
                    }}
                    className="text-[11px] font-semibold text-[#1C2B3A] bg-[#F0F4F8] hover:bg-[#1C2B3A] hover:text-white px-3 py-1.5 rounded-lg transition-all flex-shrink-0 cursor-pointer"
                  >
                    Jump ➔
                  </button>
                </div>
              ))
            )
          )}

          {activeTab === 'blockers' && (
            summaryData.blockers.length === 0 ? (
              <p className="text-xs text-[#9CA3AF] italic text-center py-8">No questions or blockers flagged in room history.</p>
            ) : (
              summaryData.blockers.map((item) => (
                <div key={item.id} className="bg-white border border-[#E8E8E2] p-3.5 rounded-xl shadow-sm hover:border-[#1C2B3A]/30 transition-all flex items-start justify-between gap-3 text-left">
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded uppercase tracking-wider">{item.sender}</span>
                    <p className="text-xs text-[#1A1A1A] mt-1.5 leading-relaxed">{item.text}</p>
                  </div>
                  <button
                    onClick={() => {
                      onJumpToMessage(item.id);
                      onClose();
                    }}
                    className="text-[11px] font-semibold text-[#1C2B3A] bg-[#F0F4F8] hover:bg-[#1C2B3A] hover:text-white px-3 py-1.5 rounded-lg transition-all flex-shrink-0 cursor-pointer"
                  >
                    Jump ➔
                  </button>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-white border-t border-[#E8E8E2] flex justify-end">
          <button
            onClick={onClose}
            className="bg-[#1C2B3A] hover:bg-[#253545] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow transition-all cursor-pointer"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
};

export default AICatchUpModal;
