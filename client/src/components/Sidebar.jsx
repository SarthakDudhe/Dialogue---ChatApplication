import React, { useContext, useEffect, useState, useRef } from 'react'
import assets from '../assets/assets'
import { formatLastSeen, compressImage } from '../lib/utils'
import { useNavigate } from 'react-router-dom'
import { AuthContext } from '../../context/AuthContext'
import { ChatContext } from '../../context/ChatContext'
import toast from 'react-hot-toast'
import axios from 'axios'

const Sidebar = () => {

  const {
    getUsers,
    users,
    conversations,
    createGroup,
    selectedUser,
    setSelectedUser,
    unseenMessages,
    setUnseenMessages,
    typingUsers,
    searchResults,
    isSearching,
    searchQuery,
    searchMessages,
    setHighlightMessageId,
    notificationSettings,
    setNotificationSettings
  } = useContext(ChatContext)

  const {logout,onlineUser,authUser}=useContext(AuthContext)

  const [input,setInput]= useState("")
  const navigate=useNavigate();

  // Create group modal states
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupAvatar, setGroupAvatar] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [activePreviewImage, setActivePreviewImage] = useState(null);

  // Chatbot states
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [chatbotInput, setChatbotInput] = useState("");
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [chatbotMessages, setChatbotMessages] = useState([
    { sender: 'bot', text: "Hello! I am Dialogue Bot, your virtual assistant. Ask me anything about Dialogue encryption, WebSockets, or group settings!", time: new Date() }
  ]);

  const chatbotScrollEndRef = useRef(null);

  const [filterTab, setFilterTab] = useState("all"); // "all" | "direct" | "groups" | "unread"

  const groupConversations = conversations.filter(c => c.isGroup);

  let filteredGroups = input 
    ? groupConversations.filter(c => c.groupName.toLowerCase().includes(input.toLowerCase()))
    : groupConversations;

  let filteredUsers = input 
    ? users.filter(user => user.fullname.toLowerCase().includes(input.toLowerCase()))
    : users;

  // Apply tab filters
  if (filterTab === "groups") {
    filteredUsers = [];
  } else if (filterTab === "direct") {
    filteredGroups = [];
  } else if (filterTab === "unread") {
    filteredUsers = filteredUsers.filter(u => unseenMessages[u._id] > 0);
    filteredGroups = filteredGroups.filter(g => unseenMessages[g._id] > 0);
  }

  useEffect(()=>{
    getUsers();
  },[onlineUser])

  // Debounce search query for messages
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      searchMessages(input);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [input]);

  // Scroll chatbot to bottom when first opened
  useEffect(() => {
    if (isChatbotOpen && chatbotScrollEndRef.current) {
      setTimeout(() => {
        if (chatbotScrollEndRef.current) {
          chatbotScrollEndRef.current.scrollIntoView({ behavior: "auto" });
        }
      }, 50);
    }
  }, [isChatbotOpen]);

  // Scroll chatbot to bottom during messages/typing updates
  useEffect(() => {
    if (chatbotScrollEndRef.current && isChatbotOpen) {
      const container = chatbotScrollEndRef.current.parentElement;
      if (container) {
        const isUserLastMessage = chatbotMessages[chatbotMessages.length - 1]?.sender === 'user';
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;

        if (isUserLastMessage || isNearBottom) {
          chatbotScrollEndRef.current.scrollIntoView({ behavior: isBotTyping ? "auto" : "smooth" });
        }
      }
    }
  }, [chatbotMessages, isBotTyping]);

  // Load chatbot messages from local storage when authenticated user changes
  useEffect(() => {
    if (authUser?._id) {
      const stored = localStorage.getItem("dialoguebot_chat_" + authUser._id);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          const formatted = parsed.map(m => ({
            ...m,
            time: new Date(m.time)
          }));
          setChatbotMessages(formatted);
        } catch (e) {
          console.error("Error parsing stored chatbot history:", e);
        }
      } else {
        setChatbotMessages([
          { sender: 'bot', text: "Hello! I am Dialogue Bot, your virtual assistant. Ask me anything about Dialogue encryption, WebSockets, or group settings!", time: new Date() }
        ]);
      }
    }
  }, [authUser]);

  // Sync chatbot messages to local storage
  useEffect(() => {
    if (authUser?._id && chatbotMessages.length > 0) {
      localStorage.setItem("dialoguebot_chat_" + authUser._id, JSON.stringify(chatbotMessages));
    }
  }, [chatbotMessages, authUser]);

  const handleSelectMessageResult = (msg) => {
    if (!authUser) return;
    
    if (msg.conversationId) {
      const group = conversations.find(c => c._id === msg.conversationId);
      if (group) {
        setSelectedUser(group);
        setUnseenMessages(prev => ({...prev, [group._id]: 0}));
      }
    } else {
      const isSentByMe = msg.senderId._id === authUser._id;
      const targetUser = isSentByMe ? msg.receiverId : msg.senderId;
      const fullUser = users.find(u => u._id === targetUser._id) || targetUser;

      setSelectedUser(fullUser);
      setUnseenMessages(prev => ({...prev, [fullUser._id]: 0}));
    }
    
    if (msg._id && setHighlightMessageId) {
      setHighlightMessageId(msg._id);
    }
  };

  const highlightText = (text, highlight) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) => 
          regex.test(part) ? (
            <mark key={i} className="bg-[#2D4A6B]/30 text-[#FAFAFA] rounded px-0.5 font-semibold">{part}</mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) return;
    if (selectedParticipants.length < 2) {
      toast.error("Select at least 2 members");
      return;
    }
    const group = await createGroup({
      groupName: groupName.trim(),
      participants: selectedParticipants,
      groupAvatar: groupAvatar || ""
    });
    if (group) {
      setIsCreateGroupOpen(false);
      setGroupName("");
      setGroupAvatar("");
      setSelectedParticipants([]);
      setSelectedUser(group);
    }
  };

  // Chatbot submit logic and streaming helper
  const submitChatbotQuery = async (queryText) => {
    if (!authUser?._id) return;
    const newUserMessage = { sender: 'user', text: queryText, time: new Date() };
    const updatedMessages = [...chatbotMessages, newUserMessage];
    setChatbotMessages(updatedMessages);
    setIsBotTyping(true);

    const botPlaceholderIndex = updatedMessages.length;
    // Pre-insert bot message with empty text
    setChatbotMessages(prev => [
      ...prev,
      { sender: 'bot', text: "", time: new Date() }
    ]);

    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || ""}/api/auth/chatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "token": localStorage.getItem("token") || ""
        },
        body: JSON.stringify({ messages: updatedMessages })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || "Failed to initialize stream");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let botResponseText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        botResponseText += chunk;

        setChatbotMessages(prev => {
          const newMsgs = [...prev];
          if (newMsgs.length > botPlaceholderIndex) {
            newMsgs[botPlaceholderIndex] = {
              ...newMsgs[botPlaceholderIndex],
              text: botResponseText
            };
          }
          return newMsgs;
        });
      }
    } catch (error) {
      console.error("Dialogue Bot streaming error:", error);
      toast.error(error.message || "Error communicating with chatbot service.");
      setChatbotMessages(prev => {
        const newMsgs = [...prev];
        if (newMsgs.length > botPlaceholderIndex) {
          newMsgs[botPlaceholderIndex] = {
            ...newMsgs[botPlaceholderIndex],
            text: "Sorry, I ran into an error connecting to Groq AI: " + error.message
          };
        }
        return newMsgs;
      });
    } finally {
      setIsBotTyping(false);
    }
  };

  const handleChatbotSubmit = async (e) => {
    e.preventDefault();
    if (!chatbotInput.trim() || isBotTyping) return;
    const query = chatbotInput.trim();
    setChatbotInput("");
    await submitChatbotQuery(query);
  };

  const handleSelectStarterChip = async (chipText) => {
    if (isBotTyping) return;
    await submitChatbotQuery(chipText);
  };

  if (isChatbotOpen) {
    return (
      <div className={`bg-[#1A1A1A] border-r border-white/10 h-full overflow-hidden text-[#FAFAFA] flex flex-col select-none transition-all duration-300 ${selectedUser ? "max-md:hidden" : ""}`}>
        {/* Chatbot Header */}
        <div className="flex-shrink-0 bg-[#111111] border-b border-white/10 px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setIsChatbotOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[#9CA3AF] hover:text-white transition-all duration-200"
            title="Back to Contacts"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2.5 flex-1">
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#1C2B3A] to-[#2D4A6B] flex items-center justify-center border border-white/20 shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4.5 h-4.5 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
                </svg>
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#111111]"></span>
            </div>
            <div className="flex flex-col leading-none text-left">
              <span className="text-sm font-bold text-[#FAFAFA]">Dialogue Bot</span>
              <span className="text-[10px] text-green-400 mt-0.5">Online · Powered by Llama 4</span>
            </div>
          </div>
          <button
            onClick={() => {
              if (authUser?._id) {
                localStorage.removeItem("dialoguebot_chat_" + authUser._id);
              }
              setChatbotMessages([
                { sender: 'bot', text: "Hello! I am Dialogue Bot, your virtual assistant. Ask me anything about Dialogue encryption, WebSockets, or group settings!", time: new Date() }
              ]);
            }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-[#9CA3AF] hover:text-red-400 transition-all duration-200"
            title="Clear chat history"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
            </svg>
          </button>
        </div>

        {/* Messages Feed */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3 sidebar-scroll" style={{background: 'linear-gradient(180deg, #161616 0%, #1A1A1A 100%)'}}>
          {chatbotMessages.map((msg, i) => {
            if (msg.sender === 'bot' && !msg.text) return null;
            return (
              <div key={i} className={`flex items-end gap-2 ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.sender === 'bot' && (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1C2B3A] to-[#2D4A6B] flex items-center justify-center flex-shrink-0 mb-1 border border-white/10">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3 h-3 text-white">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col gap-0.5 max-w-[78%]">
                  <div className={`p-2.5 px-3.5 rounded-2xl text-xs leading-relaxed text-left break-words ${
                    msg.sender === 'user'
                      ? 'bg-[#1C2B3A] text-white rounded-br-none border border-white/10'
                      : 'bg-[#242424] text-[#FAFAFA] rounded-bl-none border border-white/10'
                  }`}>
                    {msg.text}
                  </div>
                  <span className={`text-[9px] text-[#555] px-1 ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Starter Chips */}
          {chatbotMessages.length === 1 && !isBotTyping && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-[10px] text-[#555] font-semibold uppercase tracking-widest text-left px-1">Try asking...</p>
              <div className="flex flex-col gap-2">
                {[
                  { icon: "🔒", label: "How does E2EE work?" },
                  { icon: "👥", label: "What are group roles?" },
                  { icon: "⚡", label: "Tell me about WebSockets" }
                ].map((chip) => (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => handleSelectStarterChip(`${chip.icon} ${chip.label}`)}
                    className="flex items-center gap-2.5 bg-[#242424] hover:bg-[#2D4A6B]/20 border border-white/10 hover:border-[#2D4A6B]/50 text-[#FAFAFA] text-xs py-2.5 px-3.5 rounded-xl transition-all duration-150 active:scale-95 text-left group"
                  >
                    <span className="text-sm">{chip.icon}</span>
                    <span className="text-xs font-medium text-[#FAFAFA]/80 group-hover:text-white">{chip.label}</span>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3.5 h-3.5 ml-auto text-[#555] group-hover:text-[#2D4A6B] transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Typing Indicator */}
          {isBotTyping && chatbotMessages[chatbotMessages.length - 1]?.sender === 'bot' && !chatbotMessages[chatbotMessages.length - 1]?.text && (
            <div className="flex items-end gap-2">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1C2B3A] to-[#2D4A6B] flex items-center justify-center flex-shrink-0 mb-1 border border-white/10">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3 h-3 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
                </svg>
              </div>
              <div className="bg-[#242424] border border-white/10 p-3 px-4 rounded-2xl rounded-bl-none">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#555] animate-bounce" style={{animationDelay:'0ms'}}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#555] animate-bounce" style={{animationDelay:'150ms'}}></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#555] animate-bounce" style={{animationDelay:'300ms'}}></span>
                </div>
              </div>
            </div>
          )}
          <div ref={chatbotScrollEndRef}></div>
        </div>

        {/* Input Bar */}
        <form onSubmit={handleChatbotSubmit} className="flex-shrink-0 border-t border-white/10 p-3 bg-[#111111] flex gap-2.5 items-center">
          <input
            type="text"
            value={chatbotInput}
            onChange={(e) => setChatbotInput(e.target.value)}
            placeholder="Message Dialogue Bot..."
            autoFocus
            disabled={isBotTyping}
            className="flex-1 bg-white/5 border border-white/10 focus:border-[#2D4A6B]/60 rounded-xl outline-none text-sm text-[#FAFAFA] placeholder-[#555] py-2.5 px-4 transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isBotTyping || !chatbotInput.trim()}
            className="w-9 h-9 rounded-xl bg-[#1C2B3A] hover:bg-[#2D4A6B] flex items-center justify-center text-white transition-all active:scale-95 flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
            </svg>
          </button>
        </form>

        {/* Modals (keep available in chatbot view too) */}
        {activePreviewImage && (
          <div
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md transition-all duration-300 animate-fade-in"
            onClick={() => setActivePreviewImage(null)}
          >
            <div
              className="relative max-w-sm w-full mx-4 flex flex-col items-center gap-4 bg-[#1A1A1A]/95 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl animate-fade-in-scale"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-full flex justify-between items-center border-b border-white/10 pb-3">
                <h3 className="text-sm font-semibold text-[#FAFAFA] truncate max-w-[80%]">{activePreviewImage.name}</h3>
                <button onClick={() => setActivePreviewImage(null)} className="text-[#9CA3AF] hover:text-[#FAFAFA] bg-white/5 hover:bg-white/10 w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200">✕</button>
              </div>
              <div className="relative w-full aspect-square max-h-[300px] overflow-hidden rounded-xl border border-white/10 bg-[#1A1A1A]">
                <img 
                  src={activePreviewImage.img} 
                  alt={activePreviewImage.name} 
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="w-full h-full object-cover animate-fade-in select-none pointer-events-none" 
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`bg-[#1A1A1A] border-r border-white/10 h-full overflow-hidden p-4 text-[#FAFAFA] flex flex-col select-none transition-all duration-300 relative ${selectedUser?"max-md:hidden":""}`}>
        {/* User Profile Info Header */}
        <div className='pb-4 flex-shrink-0 border-b border-white/10'>
            <div className='flex justify-between items-center'>
                <div className='flex items-center gap-2.5 cursor-pointer' onClick={() => navigate('/profile')}>
                    <div className='relative'>
                      <img 
                        src={authUser?.profilePic || assets.avatar_icon} 
                        alt="Avatar" 
                        className='w-9 h-9 rounded-full object-cover border border-white/20 shadow-sm hover:scale-105 transition-transform duration-200 cursor-pointer' 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePreviewImage({ img: authUser?.profilePic || assets.avatar_icon, name: authUser?.fullname || 'Profile' });
                        }}
                      />
                      <span className='absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border border-[#1A1A1A]'></span>
                    </div>
                    <div className='flex flex-col text-left leading-none'>
                      <span className='text-sm font-semibold text-[#FAFAFA] hover:text-[#2D4A6B] transition-colors'>{authUser?.fullname || 'Profile'}</span>
                      <span className='text-[10px] text-[#9CA3AF] mt-0.5'>Active now</span>
                    </div>
                </div>

                <div className='flex items-center gap-1.5'>
                    {/* Dialogue Bot Button */}
                    <button
                      onClick={() => setIsChatbotOpen(true)}
                      className='p-2 rounded-lg hover:bg-white/5 text-[#9CA3AF] hover:text-[#FAFAFA] transition-all duration-200 relative'
                      title='Dialogue Bot AI Assistant'
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />
                      </svg>
                      <span className="absolute top-1.5 right-1.5 flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2D4A6B] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2D4A6B]"></span>
                      </span>
                    </button>
                    
                    {/* Create Group Button */}
                    <button 
                      onClick={() => setIsCreateGroupOpen(true)}
                      className='p-2 rounded-lg hover:bg-white/5 text-[#9CA3AF] hover:text-[#FAFAFA] transition-all duration-200' 
                      title='New Group Chat'
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                      </svg>
                    </button>
                    
                    {/* Settings Trigger */}
                    <div className='relative py-1 group'>
                        <button className='p-2 rounded-lg hover:bg-white/5 text-[#9CA3AF] hover:text-[#FAFAFA] transition-all duration-200'>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.557 0 1.02.4 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.273.807-.109 1.205.166.397.505.71.93.78l.894.15c.542.09.94.56.94 1.11v1.094c0 .558-.4 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.557 0-1.02-.4-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527a1.125 1.125 0 0 1-1.448-.12l-.774-.772a1.125 1.125 0 0 1-.12-1.45l.527-.737c.251-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.11v-1.094c0-.557.4-1.02.94-1.11l.894-.148c.424-.07.765-.385.93-.782.165-.398.142-.854-.108-1.204l-.527-.738a1.125 1.125 0 0 1 .12-1.45l.772-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.108.397-.165.71-.505.78-.929l.15-.894Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                        </button>
                        
                        {/* Settings Dropdown Menu */}
                        <div className='absolute top-full right-0 z-20 w-52 p-4 rounded-xl bg-[#1A1A1A] border border-white/10 text-[#FAFAFA] hidden group-hover:block shadow-2xl backdrop-blur-xl animate-fade-in'>
                          <p onClick={()=>navigate('/profile')} className='cursor-pointer text-sm hover:text-[#2D4A6B] transition-colors font-medium flex items-center gap-2'>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                            </svg>
                            Edit Profile
                          </p>
                          <hr className='my-2.5 border-t border-white/10'/>
                          
                          <div className='flex flex-col gap-3.5 my-2.5 text-xs text-[#9CA3AF]'>
                            <div className='flex justify-between items-center'>
                              <span>Chime Sound</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type='checkbox' 
                                  checked={notificationSettings?.sound ?? true}
                                  onChange={(e) => setNotificationSettings(prev => ({...prev, sound: e.target.checked}))}
                                  className='sr-only peer'
                                />
                                <div className="w-8 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#2D4A6B]"></div>
                              </label>
                            </div>
                            <div className='flex justify-between items-center'>
                              <span>Desktop Alerts</span>
                              <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                  type='checkbox' 
                                  checked={notificationSettings?.desktop ?? true}
                                  onChange={(e) => setNotificationSettings(prev => ({...prev, desktop: e.target.checked}))}
                                  className='sr-only peer'
                                />
                                <div className="w-8 h-4 bg-white/10 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[#2D4A6B]"></div>
                              </label>
                            </div>
                          </div>
                          <hr className='my-2.5 border-t border-white/10'/>
                          <p className='cursor-pointer text-sm text-red-400 hover:text-red-350 transition-colors font-medium flex items-center gap-2' onClick={()=>logout()}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                            </svg>
                            Logout
                          </p>
                        </div>
                    </div>
                </div>
            </div>

         {/* Premium Search Container */}
         <div className='bg-white/5 border border-white/10 rounded-xl flex items-center gap-3 py-2.5 px-4 mt-4 transition-all focus-within:border-[#2D4A6B]/50 focus-within:ring-1 focus-within:ring-[#2D4A6B]/50'>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" className="w-4 h-4 text-[#9CA3AF]">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
          </svg>
          <input 
            type="text" 
            value={input}
            onChange={(e)=>setInput(e.target.value)} 
            className='bg-transparent border-none outline-none text-[#FAFAFA] text-xs placeholder-[#9CA3AF] flex-1' 
            placeholder='Search chats or messages...' 
          />
         </div>

          {/* Quick Filter Bar */}
          <div className='flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 no-scrollbar'>
            {[
              { id: 'all', label: 'All' },
              { id: 'direct', label: 'Direct' },
              { id: 'groups', label: 'Groups' },
              { id: 'unread', label: 'Unread' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  filterTab === tab.id
                    ? 'bg-[#1C2B3A] text-white border border-[#2D4A6B]/50 shadow-sm'
                    : 'bg-white/5 text-[#9CA3AF] hover:text-white hover:bg-white/10 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
         </div>

      {/* Categorized Lists */}
      <div className='flex-1 min-h-0 overflow-y-auto pr-1 mt-4 flex flex-col gap-5 sidebar-scroll'>
        {/* Groups Column */}
        {filteredGroups.length > 0 && (
          <div>
            <p className='text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest px-2 mb-2 flex justify-between items-center'>
              <span className='flex items-center gap-1.5'>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
                </svg>
                Groups
              </span>
              <span className='bg-white/5 text-[#9CA3AF] text-[9px] px-1.5 py-0.5 rounded font-mono'>{filteredGroups.length}</span>
            </p>
            <div className='flex flex-col gap-1.5'>
              {filteredGroups.map((group) => {
                const isSelected = selectedUser && selectedUser.isGroup && selectedUser._id === group._id;
                const isTyping = typingUsers[group._id] && Object.keys(typingUsers[group._id]).length > 0;
                const typingMemberIds = isTyping ? Object.keys(typingUsers[group._id]) : [];
                const typingText = isTyping 
                  ? `${typingMemberIds.map(id => users.find(u => u._id === id)?.fullname || "Someone").join(", ")} typing...`
                  : "";
                
                return (
                  <div 
                    key={group._id} 
                    onClick={() => {
                      setSelectedUser(group);
                      setUnseenMessages(prev => ({...prev, [group._id]: 0}));
                    }} 
                    className={`relative flex items-center gap-3 p-2.5 pl-4 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/5 active:scale-[0.98] ${isSelected ? 'bg-white/10 border border-white/10' : 'border border-transparent'}`}
                  >
                    {isSelected && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-md bg-[#2D4A6B] shadow-[0_0_8px_#2D4A6B]"></span>
                    )}

                    <div className='relative flex-shrink-0'>
                      <img 
                        src={group.groupAvatar || assets.avatar_icon} 
                        alt="" 
                        className='w-9 h-9 rounded-full object-cover border border-white/20 shadow-sm hover:scale-105 transition-transform duration-200 cursor-pointer'
                        onClick={(e) => {
                          e.stopPropagation();
                          setActivePreviewImage({ img: group.groupAvatar || assets.avatar_icon, name: group.groupName });
                        }}
                      />
                    </div>
                    <div className='flex flex-col leading-tight flex-1 min-w-0 text-left'>
                      <p className='font-semibold text-sm text-[#FAFAFA] truncate'>{group.groupName}</p>
                      {isTyping ? (
                        <span className='text-[#2D4A6B] text-[10px] font-medium mt-0.5 animate-pulse'>{typingText}</span>
                      ) : (
                        <span className='text-[10px] mt-0.5 truncate text-[#9CA3AF]'>
                          {group.participants.map(p => p.fullname).join(", ")}
                        </span>
                      )}
                    </div>
                    {unseenMessages[group._id] > 0 && (
                      <p className='absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#1C2B3A] text-[#FAFAFA] shadow-[0_0_8px_rgba(28,43,58,0.3)] animate-pulse'>
                        {unseenMessages[group._id]}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Contacts Column */}
        <div>
          <p className='text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest px-2 mb-2 flex justify-between items-center'>
            <span className='flex items-center gap-1.5'>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
              Direct Messages
            </span>
            <span className='bg-white/5 text-[#9CA3AF] text-[9px] px-1.5 py-0.5 rounded font-mono'>{filteredUsers.length}</span>
          </p>
          <div className='flex flex-col gap-1.5'>
            {filteredUsers.length === 0 ? (
              <p className='text-xs text-[#9CA3AF] px-2 py-1'>No contacts found</p>
            ) : (
              filteredUsers.map((user)=>(
                <div 
                  key={user._id} 
                  onClick={()=>{
                    setSelectedUser(user);
                    setUnseenMessages(prev=>({...prev,[user._id]:0}))
                  }} 
                  className={`relative flex items-center gap-3 p-2.5 pl-4 rounded-xl cursor-pointer transition-all duration-200 hover:bg-white/5 active:scale-[0.98] ${selectedUser && !selectedUser.isGroup && selectedUser._id === user._id ? 'bg-white/10 border border-white/10' : 'border border-transparent'}`}
                >
                  {selectedUser && !selectedUser.isGroup && selectedUser._id === user._id && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-r-md bg-[#2D4A6B] shadow-[0_0_8px_#2D4A6B]"></span>
                  )}

                  <div className='relative flex-shrink-0'>
                    <img 
                      src={user?.profilePic || assets.avatar_icon} 
                      alt="" 
                      className='w-9 h-9 rounded-full object-cover border border-white/20 shadow-sm hover:scale-105 transition-transform duration-200 cursor-pointer'
                      onClick={(e) => {
                        e.stopPropagation();
                        setActivePreviewImage({ img: user.profilePic || assets.avatar_icon, name: user.fullname });
                      }}
                    />
                    {onlineUser.includes(user._id) && (
                      <span className='absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#1A1A1A] animate-pulse'></span>
                    )}
                  </div>
                  <div className='flex flex-col leading-tight flex-1 min-w-0 text-left'>
                    <p className='font-semibold text-sm text-[#FAFAFA] truncate'>{user.fullname}</p>
                    {typingUsers[user._id] ? (
                      <span className='text-[#2D4A6B] text-[10px] font-medium mt-0.5 animate-pulse'>typing...</span>
                    ) : onlineUser.includes(user._id) ? (
                      <span className='text-green-400 text-[10px] font-medium mt-0.5'>Online</span>
                    ) : (
                      <span className='text-[#9CA3AF] text-[10px] mt-0.5'>{formatLastSeen(user.lastSeen)}</span>
                    )}
                  </div>
                  {unseenMessages[user._id]>0 && (
                    <p className='absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-[#1C2B3A] text-[#FAFAFA] shadow-[0_0_8px_rgba(28,43,58,0.3)] animate-pulse'>
                      {unseenMessages[user._id]}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Message Search Section */}
        {input.trim() !== "" && (
          <div className='border-t border-white/10 pt-4'>
            <p className='text-[10px] text-[#9CA3AF] font-bold uppercase tracking-widest px-2 mb-2'>Search Results</p>
            {isSearching ? (
              <p className='text-xs text-[#9CA3AF] px-2 py-1 animate-pulse'>Searching...</p>
            ) : searchResults.length === 0 ? (
              <p className='text-xs text-[#9CA3AF] px-2 py-1'>No matching messages</p>
            ) : (
              <div className='flex flex-col gap-2'>
                {searchResults.map((msg) => (
                  <div 
                    key={msg._id} 
                    onClick={() => handleSelectMessageResult(msg)}
                    className='bg-white/2 hover:bg-white/5 p-3 rounded-xl cursor-pointer transition border border-white/10 hover:border-[#2D4A6B]/50 flex flex-col gap-1.5'
                  >
                    <div className='flex justify-between items-center text-[10px] text-[#9CA3AF]'>
                      <span className='font-semibold text-[#FAFAFA]'>
                        {msg.senderId._id === authUser?._id ? 'You' : msg.senderId.fullname}
                      </span>
                      <span>{formatMessageTime(msg.createdAt)}</span>
                    </div>
                    <p className='text-xs text-gray-350 line-clamp-2 leading-relaxed text-left'>
                      {highlightText(msg.text, input)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>


      {isCreateGroupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md transition-all duration-300">
          <div className="bg-[#1A1A1A] border border-white/10 w-full max-w-md p-6 rounded-2xl shadow-2xl flex flex-col gap-4 text-[#FAFAFA] mx-4 animate-fade-in-scale">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-lg font-bold font-headline text-[#FAFAFA]">Create Group Chat</h3>
              <button onClick={() => setIsCreateGroupOpen(false)} className="text-[#9CA3AF] hover:text-[#FAFAFA] text-sm">✕</button>
            </div>

            <div className="flex flex-col gap-3">
              <label className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wider text-left">Group Details</label>
              
              <div className="flex items-center gap-4">
                <div className="relative flex-shrink-0">
                  <img 
                    src={groupAvatar || assets.avatar_icon} 
                    alt="Group Avatar" 
                    className="w-14 h-14 rounded-full object-cover border border-white/20 shadow-md"
                  />
                  <label htmlFor="group-avatar-input" className="absolute bottom-0 right-0 bg-[#1C2B3A] hover:bg-[#253545] text-white rounded-full p-1.5 cursor-pointer shadow-md transition-colors border border-white/20 flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.5 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                    </svg>
                    <input 
                      type="file" 
                      id="group-avatar-input" 
                      accept="image/*" 
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          try {
                            const compressed = await compressImage(file, 200);
                            setGroupAvatar(compressed);
                          } catch (err) {
                            toast.error("Error processing image");
                          }
                        }
                      }} 
                      hidden 
                    />
                  </label>
                </div>
                <div className="flex-1">
                  <input 
                    type="text" 
                    placeholder="Enter group name..." 
                    value={groupName} 
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white/5 border border-white/10 outline-none text-sm text-[#FAFAFA] focus:ring-1 focus:ring-[#2D4A6B] placeholder-neutral-500"
                  />
                </div>
              </div>

              <label className="text-xs text-[#9CA3AF] font-semibold uppercase tracking-wider mt-2 text-left">Select Members (Min 2)</label>
              <div className="max-h-48 overflow-y-auto border border-white/10 rounded-xl bg-white/3 p-2 flex flex-col gap-1.5">
                {users.map((user) => (
                  <label key={user._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
                    <div className="flex items-center gap-2.5">
                      <img src={user.profilePic || assets.avatar_icon} alt="" className="w-8 h-8 rounded-full object-cover border border-white/25" />
                      <span className="text-sm font-medium text-[#FAFAFA]">{user.fullname}</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={selectedParticipants.includes(user._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedParticipants(prev => [...prev, user._id]);
                        } else {
                          setSelectedParticipants(prev => prev.filter(id => id !== user._id));
                        }
                      }}
                      className="w-4 h-4 rounded border-white/20 text-[#1C2B3A] focus:ring-[#1C2B3A] bg-white/5"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-white/10">
              <button 
                onClick={() => setIsCreateGroupOpen(false)} 
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-semibold transition-colors text-[#FAFAFA]"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateGroup} 
                disabled={!groupName.trim() || selectedParticipants.length < 2}
                className="px-4 py-2 rounded-xl bg-[#1C2B3A] hover:bg-[#253545] disabled:opacity-50 text-sm font-semibold transition-colors text-white"
              >
                Create Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Image Preview Modal */}
      {activePreviewImage && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/85 backdrop-blur-md transition-all duration-300 animate-fade-in"
          onClick={() => setActivePreviewImage(null)}
        >
          <div 
            className="relative max-w-sm w-full mx-4 flex flex-col items-center gap-4 bg-[#1A1A1A]/95 backdrop-blur-xl border border-white/10 p-5 rounded-2xl shadow-2xl animate-fade-in-scale"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header / Name */}
            <div className="w-full flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-sm font-semibold text-[#FAFAFA] truncate max-w-[80%]">
                {activePreviewImage.name}
              </h3>
              <button 
                onClick={() => setActivePreviewImage(null)} 
                className="text-[#9CA3AF] hover:text-[#FAFAFA] bg-white/5 hover:bg-white/10 w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200"
              >
                ✕
              </button>
            </div>

            {/* Image Container */}
            <div className="relative w-full aspect-square max-h-[300px] overflow-hidden rounded-xl border border-white/10 bg-[#1A1A1A]">
              <img 
                src={activePreviewImage.img} 
                alt={activePreviewImage.name} 
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="w-full h-full object-cover animate-fade-in select-none pointer-events-none"
              />
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default Sidebar;
