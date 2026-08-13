import React, { useState } from 'react';
import toast from 'react-hot-toast';

/**
 * PollCreatorModal Component
 * Allows users to create encrypted interactive team polls inside room channels.
 */
const PollCreatorModal = ({ isOpen, onClose, onCreatePoll }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);

  if (!isOpen) return null;

  const handleAddOption = () => {
    if (options.length >= 5) {
      toast.error("Maximum 5 poll options allowed.");
      return;
    }
    setOptions((prev) => [...prev, '']);
  };

  const handleOptionChange = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleRemoveOption = (index) => {
    if (options.length <= 2) {
      toast.error("Polls require at least 2 options.");
      return;
    }
    setOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!question.trim()) {
      toast.error("Enter a poll question.");
      return;
    }

    const validOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (validOptions.length < 2) {
      toast.error("Enter at least 2 valid options.");
      return;
    }

    // Format poll payload as JSON string embedded in text
    const pollPayload = {
      isPoll: true,
      question: question.trim(),
      options: validOptions.map((opt, idx) => ({ id: idx, text: opt, votes: 0 }))
    };

    onCreatePoll(`📊 POLL:${JSON.stringify(pollPayload)}`);
    setQuestion('');
    setOptions(['', '']);
    onClose();
    toast.success("Poll launched successfully!", { icon: "📊" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-[#E8E8E2] w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col text-[#1A1A1A]">
        {/* Header */}
        <div className="bg-[#1C2B3A] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📊</span>
            <div>
              <h3 className="font-bold text-base font-headline">Create Team Poll</h3>
              <p className="text-xs text-blue-200/80">Gather instant feedback & room consensus</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white transition-all text-lg cursor-pointer p-1 rounded-lg hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[#FAFAFA]">
          <div>
            <label className="block text-xs font-bold text-[#1C2B3A] mb-1">Poll Question</label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. When should we release v1.2 build?"
              className="w-full text-xs p-3 bg-white border border-[#E8E8E2] rounded-xl outline-none focus:border-[#1C2B3A] text-[#1A1A1A]"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#1C2B3A]">Options</label>
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className="flex-1 text-xs p-2.5 bg-white border border-[#E8E8E2] rounded-xl outline-none focus:border-[#1C2B3A] text-[#1A1A1A]"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="text-xs text-red-500 hover:text-red-700 p-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < 5 && (
            <button
              type="button"
              onClick={handleAddOption}
              className="text-xs font-bold text-[#1C2B3A] hover:underline flex items-center gap-1 cursor-pointer pt-1"
            >
              <span>+ Add Option</span>
            </button>
          )}

          {/* Footer */}
          <div className="pt-4 border-t border-[#E8E8E2] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#F5F5F0] hover:bg-[#E8E8E2] text-xs font-semibold rounded-xl text-[#1A1A1A] border border-[#E8E8E2]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#1C2B3A] hover:bg-[#253545] text-white text-xs font-bold rounded-xl shadow transition-all cursor-pointer"
            >
              Launch Poll 🚀
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PollCreatorModal;
