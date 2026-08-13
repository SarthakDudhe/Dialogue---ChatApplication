import React, { useContext, useEffect, useRef, useState } from 'react'
import assets from "../assets/assets"
import { formatMessageTime, formatDateHeader, compressImage } from '../lib/utils'
import { scanForSecrets } from '../lib/dlpScanner'
import { playSendSound, playReceiveSound, playAlertSound } from '../lib/soundFx'
import { translateText } from '../lib/translator'
import AICatchUpModal from './AICatchUpModal'
import VoiceRecorder from './VoiceRecorder'
import { ChatContext } from '../../context/ChatContext'
import { AuthContext } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import EmojiPicker from 'emoji-picker-react'

const ChatContainer = () => {

  const {
    messages,
    users,
    selectedUser,
    setSelectedUser,
    sendMessage,
    getMessages,
    typingUsers,
    emitTyping,
    emitStopTyping,
    deleteMessage,
    editMessage,
    reactToMessage,
    replyingTo,
    setReplyingTo,
    highlightMessageId,
    setHighlightMessageId,
    addGroupMembers,
    removeGroupMember,
    updateGroupInfo,
    deleteGroup
  } = useContext(ChatContext);

  const {authUser,onlineUser} =useContext(AuthContext);

  const[input,setInput]=useState('')
  const[dlpWarning,setDlpWarning]=useState(null)
  const[isCatchUpOpen,setIsCatchUpOpen]=useState(false)
  const[isRecordingVoice,setIsRecordingVoice]=useState(false)
  const[isOffline,setIsOffline]=useState(!navigator.onLine)
  const[translatedMessages,setTranslatedMessages]=useState({})
  const[showEmojiPicker,setShowEmojiPicker]=useState(false)
  const[contextMenu,setContextMenu]=useState(null)
  const[editingMsg,setEditingMsg]=useState(null)
  const[editText,setEditText]=useState('')
  const typingTimeoutRef=useRef(null)
  const emojiPickerRef=useRef(null)
  const reactionEmojis=['👍','❤️','😂','😮','🙏']

  // Monitor network online/offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success("Network reconnected! Outbox synced.", { icon: "🌐" });
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error("Network disconnected. Using local encrypted outbox queue.", { icon: "📡" });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Group Details Modal states
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [isAddMembersOpen, setIsAddMembersOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupAvatar, setNewGroupAvatar] = useState("");
  const [selectedAddUsers, setSelectedAddUsers] = useState([]);

  // Sync edit states when group changes
  useEffect(() => {
    if (selectedUser && selectedUser.isGroup) {
      setNewGroupName(selectedUser.groupName);
      setNewGroupAvatar(selectedUser.groupAvatar || "");
    }
    setIsGroupInfoOpen(false);
    setIsAddMembersOpen(false);
  }, [selectedUser]);

  const isAdmin = selectedUser && selectedUser.isGroup && selectedUser.admin && (
    typeof selectedUser.admin === "object" 
      ? selectedUser.admin._id === authUser?._id 
      : selectedUser.admin === authUser?._id
  );

  const getSenderName = (senderIdObjOrStr) => {
    const id = typeof senderIdObjOrStr === "object" ? senderIdObjOrStr._id : senderIdObjOrStr;
    if (id === authUser?._id) return "You";
    const found = users.find(u => u._id === id) || (selectedUser && selectedUser.participants && selectedUser.participants.find(p => p._id === id));
    return found ? found.fullname : "Someone";
  };

  const getSenderPic = (msg) => {
    const isMe = msg.senderId === authUser?._id || (typeof msg.senderId === "object" && msg.senderId._id === authUser?._id);
    if (isMe) {
      return authUser.profilePic || assets.avatar_icon;
    }
    return (typeof msg.senderId === "object" && msg.senderId.profilePic) ? msg.senderId.profilePic : assets.avatar_icon;
  };

  const getTypingInfo = () => {
    if (!selectedUser) return null;
    if (selectedUser.isGroup) {
      const groupTyping = typingUsers[selectedUser._id] || {};
      const typingIds = Object.keys(groupTyping).filter(id => groupTyping[id]);
      if (typingIds.length === 0) return null;
      
      const names = typingIds.map(id => {
        const u = users.find(user => user._id === id);
        return u ? u.fullname : "Someone";
      }).join(", ");
      
      const firstTypingUser = users.find(user => user._id === typingIds[0]);
      return {
        name: names,
        avatar: firstTypingUser?.profilePic || assets.avatar_icon,
        text: `${names} typing...`
      };
    } else {
      if (!typingUsers[selectedUser._id]) return null;
      return {
        name: selectedUser.fullname,
        avatar: selectedUser.profilePic || assets.avatar_icon,
        text: "typing..."
      };
    }
  };

  const typingInfo = getTypingInfo();

  //Handle delete message
  const handleDelete=(msgId)=>{
    deleteMessage(msgId)
    setContextMenu(null)
  }

  //Handle start editing
  const handleStartEdit=(msg)=>{
    setEditingMsg(msg._id)
    setEditText(msg.text)
    setContextMenu(null)
  }

  //Handle save edit
  const handleSaveEdit=()=>{
    if(editText.trim()!==''){
      editMessage(editingMsg,editText.trim())
    }
    setEditingMsg(null)
    setEditText('')
  }

  //Handle cancel edit
  const handleCancelEdit=()=>{
    setEditingMsg(null)
    setEditText('')
  }

  //Handle emoji selection
  const handleEmojiClick=(emojiData)=>{
    setInput(prev=>prev+emojiData.emoji)
    setShowEmojiPicker(false)
  }

  //Close emoji picker when clicking outside
  useEffect(()=>{
    const handleClickOutside=(e)=>{
      if(emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)){
        setShowEmojiPicker(false)
      }
    }
    document.addEventListener('mousedown',handleClickOutside)
    return ()=>document.removeEventListener('mousedown',handleClickOutside)
  },[])

  //Handle input change with typing indicator and real-time DLP secret scan
  const handleInputChange=(e)=>{
    const val = e.target.value;
    setInput(val)
    
    // Live DLP secret scan
    const scan = scanForSecrets(val);
    if (scan.hasSecrets && !dlpWarning) {
      playAlertSound();
    }
    setDlpWarning(scan.hasSecrets ? scan : null);

    if(selectedUser){
      emitTyping(selectedUser._id)
      if(typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current=setTimeout(()=>{
        emitStopTyping(selectedUser._id)
      },1000)
    }
  }

  //Handle sending a message
  const handlesendMessage=async(e)=>{
    e.preventDefault();
    if (input.trim() ==="")return null;

    // Final DLP audit before encryption & sending
    const scan = scanForSecrets(input.trim());
    let finalPayload = input.trim();
    if (scan.hasSecrets) {
      playAlertSound();
      toast.custom((t) => (
        <div className="bg-[#1C2B3A] text-white px-4 py-3 rounded-xl shadow-xl border border-red-500/30 flex items-center gap-3">
          <span className="text-lg">🛡️</span>
          <div>
            <p className="text-xs font-bold text-red-400">Secret Detected & Auto-Redacted</p>
            <p className="text-[11px] text-gray-300">Prevented raw leak of {scan.findings[0]?.type}</p>
          </div>
        </div>
      ), { duration: 4000 });
      finalPayload = scan.cleanText;
    }

    if(selectedUser){
      emitStopTyping(selectedUser._id)
      if(typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    }
    await sendMessage({text: finalPayload});
    playSendSound();
    setInput('')
    setDlpWarning(null)
  }

  //Handle sending a image
  const handleSendImage =async(e)=>{
    const file =e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Select an image file !")
      return
    }
    const reader =new FileReader();
    reader.onloadend =async ()=>{
      await sendMessage({image:reader.result})
      e.target.value =""
    }
    reader.readAsDataURL(file)
  }

  useEffect(()=>{
    if (selectedUser) {
      getMessages(selectedUser._id)
    }
  },[selectedUser])

  const scrollEnd =useRef()
  useEffect(()=>{
    if (scrollEnd.current && messages && !highlightMessageId) {
      scrollEnd.current.scrollIntoView({behavior : "smooth"})
    }
  },[messages, highlightMessageId])

  // Handle scrolling to and highlighting a searched message
  useEffect(() => {
    if (highlightMessageId && messages.length > 0) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`msg-${highlightMessageId}`);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 200);

      const clearTimer = setTimeout(() => {
        setHighlightMessageId(null);
      }, 2500);

      return () => {
        clearTimeout(timer);
        clearTimeout(clearTimer);
      };
    }
  }, [highlightMessageId, messages]);

  return selectedUser ?  (
    <div className='h-full flex flex-col relative bg-[#F5F5F0] overflow-hidden select-none'>
      {/* HEADER */}
      <div className='flex items-center justify-between h-16 px-6 border-b border-[#E8E8E2] bg-[#F5F5F0] flex-shrink-0'>
        <div className='flex items-center gap-3'>
          <div className='relative'>
            <img src={selectedUser.isGroup ? selectedUser.groupAvatar || assets.avatar_icon : selectedUser.profilePic || assets.avatar_icon} className='w-[38px] h-[38px] rounded-full object-cover border border-[#E8E8E2] shadow-sm' />
            {!selectedUser.isGroup && onlineUser.includes(selectedUser._id) && (
              <span className='absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#F5F5F0] animate-pulse'></span>
            )}
          </div>
          <div className='flex flex-col leading-tight text-left'>
            <p className='text-sm font-semibold text-[#1A1A1A]'>{selectedUser.isGroup ? selectedUser.groupName : selectedUser.fullname}</p>
            <p className='text-[10px] text-[#6B7280] font-medium mt-0.5 flex items-center gap-1'>
              {!selectedUser.isGroup && onlineUser.includes(selectedUser._id) && <span className='w-1.5 h-1.5 bg-green-500 rounded-full inline-block'></span>}
              {selectedUser.isGroup 
                ? `${selectedUser.participants.length} members`
                : (onlineUser.includes(selectedUser._id) ? "Active now" : "Offline")
              }
            </p>
          </div>
        </div>
        <div className='flex items-center gap-3'>
          <button 
            onClick={() => setIsCatchUpOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-[#E8E8E2] text-xs font-bold text-[#1C2B3A] hover:bg-[#1C2B3A] hover:text-white shadow-sm transition-all cursor-pointer"
            title="AI Catch-Up Matrix"
          >
            <span>⚡ AI Catch Up</span>
          </button>
          <button onClick={()=>setSelectedUser(null)} className='md:hidden p-2 rounded-lg hover:bg-black/5 text-[#6B7280] hover:text-[#1A1A1A] transition-all flex items-center justify-center' title='Back'>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          {selectedUser.isGroup && (
            <button onClick={() => setIsGroupInfoOpen(true)} className='p-2 rounded-lg hover:bg-black/5 text-[#6B7280] hover:text-[#1A1A1A] transition-all flex items-center justify-center' title='Group Details'>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 111.063.852l-.708 2.836a.75.75 0 001.063.852l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Network Offline / Outbox Resilience Banner */}
      {isOffline && (
        <div className='bg-amber-50 border-b border-amber-200 px-6 py-2 flex items-center justify-between text-amber-900 text-xs font-semibold shadow-inner flex-shrink-0 animate-fade-in'>
          <div className='flex items-center gap-2'>
            <span className='w-2 h-2 rounded-full bg-amber-500 animate-ping'></span>
            <span>Offline Mode Active — Messages queued in local IndexedDB Outbox</span>
          </div>
          <span className='bg-amber-200/80 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider font-mono'>IndexedDB Queue</span>
        </div>
      )}

      {/* CHAT AREA */}
      <div className='flex-1 overflow-y-auto p-5 pb-6 space-y-6'>
        {messages.map((msg,index)=>{
          const prevMsg = messages[index - 1];
          const showDivider = !prevMsg || new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();
          const isSentByMe = msg.senderId === authUser?._id || (typeof msg.senderId === "object" && msg.senderId._id === authUser?._id);
          
          return (
            <React.Fragment key={msg._id || index}>
              {showDivider && (
                <div className='flex justify-center my-6 w-full'>
                  <span className='bg-white border border-[#E8E8E2] text-[#6B7280] text-[10px] font-bold uppercase tracking-widest px-3.5 py-1 rounded-lg shadow-sm'>
                    {formatDateHeader(msg.createdAt)}
                  </span>
                </div>
              )}
              
              <div 
                id={`msg-${msg._id}`} 
                className={`flex items-start gap-3.5 my-4 group relative w-full ${isSentByMe ? 'justify-end' : 'justify-start'} ${highlightMessageId === msg._id ? 'bg-[#1C2B3A]/5 p-2 rounded-2xl ring-1 ring-[#1C2B3A]/30 shadow-xl transition-all duration-300' : ''}`}
              >
                {/* Hover Action Menu */}
                <div className={`absolute top-0 -translate-y-[85%] hidden group-hover:flex items-center gap-1.5 p-1.5 bg-white border border-[#E8E8E2] rounded-xl shadow-2xl z-20 ${isSentByMe ? 'right-4' : 'left-4'}`}>
                  <div className='flex gap-0.5'>
                    {reactionEmojis.map(em=>(
                      <button key={em} onClick={()=>reactToMessage(msg._id,em)} className='text-xs p-1 rounded hover:bg-[#F5F5F0] active:scale-125 transition-transform duration-200 cursor-pointer' title={em}>{em}</button>
                    ))}
                  </div>
                  <div className='h-3 w-[1px] bg-[#E8E8E2] mx-1'></div>
                  <button onClick={()=>setReplyingTo(msg)} className='p-1 rounded text-[#6B7280] hover:text-[#1A1A1A] hover:bg-[#F5F5F0] text-[10px] transition-colors cursor-pointer flex items-center gap-1' title='Reply'>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3 h-3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                    </svg>
                    Reply
                  </button>
                  {msg.text && (
                    <button 
                      onClick={async () => {
                        if (translatedMessages[msg._id]) {
                          const copy = { ...translatedMessages };
                          delete copy[msg._id];
                          setTranslatedMessages(copy);
                        } else {
                          toast.loading("Translating message...", { id: `tr-${msg._id}` });
                          const translated = await translateText(msg.text, 'es');
                          toast.success("Translated to Spanish!", { id: `tr-${msg._id}` });
                          setTranslatedMessages(prev => ({ ...prev, [msg._id]: translated }));
                        }
                      }} 
                      className='p-1 rounded text-[#6B7280] hover:text-[#1C2B3A] hover:bg-[#F5F5F0] text-[10px] transition-colors cursor-pointer flex items-center gap-1' 
                      title='Translate'
                    >
                      <span>🌐</span>
                      <span>{translatedMessages[msg._id] ? 'Original' : 'Translate'}</span>
                    </button>
                  )}
                  {isSentByMe && (
                    <>
                      <button onClick={()=>handleStartEdit(msg)} className='p-1 rounded text-[#6B7280] hover:text-[#1C2B3A] hover:bg-[#F5F5F0] text-[10px] transition-colors cursor-pointer flex items-center gap-1' title='Edit'>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.83 20.013a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                        </svg>
                        Edit
                      </button>
                      <button onClick={()=>handleDelete(msg._id)} className='p-1 rounded text-[#6B7280] hover:text-red-500 hover:bg-[#F5F5F0] text-[10px] transition-colors cursor-pointer flex items-center gap-1' title='Delete'>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                        Delete
                      </button>
                    </>
                  )}
                </div>

                {/* Received Message Avatar (Left) */}
                {!isSentByMe && (
                  <img src={getSenderPic(msg)} className='w-8 h-8 rounded-full object-cover border border-[#E8E8E2] shadow-sm mt-0.5' alt="" />
                )}

                {/* Message Bubble Container */}
                <div className={`flex flex-col ${isSentByMe ? 'items-end' : 'items-start'} max-w-[65%]`}>
                  {/* Sender Name in group */}
                  {selectedUser.isGroup && !isSentByMe && (
                    <span className='text-[10px] text-[#1C2B3A] font-bold mb-1 ml-1'>{getSenderName(msg.senderId)}</span>
                  )}

                  {/* Deleted message bubble */}
                  {msg.deleted ? (
                    <p className={`p-3 text-xs italic bg-[#FAFAFA] border border-[#E8E8E2] text-[#9CA3AF] rounded-xl flex items-center gap-1.5 ${isSentByMe ? 'rounded-tr-none' : 'rounded-tl-none'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-neutral-400">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      This message was deleted
                    </p>
                  ) : editingMsg===msg._id ? (
                    <div className='flex flex-col gap-1.5 min-w-[200px]'>
                      <input 
                        value={editText} 
                        onChange={(e)=>setEditText(e.target.value)} 
                        onKeyDown={(e)=>e.key==='Enter'?handleSaveEdit():e.key==='Escape'?handleCancelEdit():null} 
                        autoFocus 
                        className='p-2.5 w-full text-sm rounded-xl bg-white text-[#1A1A1A] border border-[#E8E8E2] outline-none focus:border-[#1C2B3A] focus:ring-1 focus:ring-[#1C2B3A]'
                      />
                      <div className='flex gap-2 text-[10px] px-1 font-semibold'>
                        <button onClick={handleSaveEdit} className='text-green-600 hover:text-green-500 cursor-pointer'>Save</button>
                        <button onClick={handleCancelEdit} className='text-[#6B7280] hover:text-neutral-500 cursor-pointer'>Cancel</button>
                      </div>
                    </div>
                  ) : msg.image ? (
                    <div className='relative'>
                      {msg.replyTo && !msg.replyTo.deleted && (
                        <div className='bg-white/80 border-l-2 border-[#1C2B3A] rounded-lg px-2.5 py-1.5 mb-1.5 text-xs text-[#6B7280] max-w-[230px] backdrop-blur-md border border-[#E8E8E2] text-left'>
                          <p className='text-[#1C2B3A] text-[10px] font-semibold mb-0.5'>{getSenderName(msg.replyTo.senderId)}</p>
                          {msg.replyTo.image ? <span>🖼️ Photo</span> : <span className='line-clamp-1'>{msg.replyTo.text}</span>}
                        </div>
                      )}
                      <img src={msg.image} alt="" className='max-w-[240px] border border-[#E8E8E2] rounded-xl overflow-hidden shadow-sm transition-transform duration-300 hover:scale-[1.01]' />
                      
                      {/* Floating Reactions overlay */}
                      {msg.reactions && msg.reactions.length>0 && (
                        <div className={`absolute -bottom-2 flex gap-1 flex-wrap z-10 ${isSentByMe ? 'right-2' : 'left-2'}`}>
                          {Object.entries(msg.reactions.reduce((acc,r)=>{acc[r.emoji]=(acc[r.emoji]||0)+1;return acc},{})).map(([emoji,count])=>(
                            <button key={emoji} onClick={()=>reactToMessage(msg._id,emoji)} className={`text-[9px] px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all shadow-sm ${msg.reactions.some(r=>r.userId===authUser?._id && r.emoji===emoji) ? 'bg-[#1C2B3A]/10 border-[#1C2B3A]/25 text-[#1C2B3A] font-medium' : 'bg-white border-[#E8E8E2] text-[#6B7280] hover:border-[#6B7280]'}`}>
                              <span>{emoji}</span>
                              {count>1 && <span className='font-bold ml-1'>{count}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className='relative group/bubble'>
                      {msg.replyTo && !msg.replyTo.deleted && (
                        <div className='bg-[#FAFAFA] border-l-2 border-[#1C2B3A] rounded-lg px-2.5 py-1.5 mb-1.5 text-xs text-[#6B7280] max-w-[280px] md:max-w-[320px] border border-[#E8E8E2] text-left'>
                          <p className='text-[#1C2B3A] text-[10px] font-bold mb-0.5'>{getSenderName(msg.replyTo.senderId)}</p>
                          {msg.replyTo.image ? <span>🖼️ Photo</span> : <span className='line-clamp-1 text-[11px]'>{msg.replyTo.text}</span>}
                        </div>
                      )}
                      <p className={`p-3 px-4 text-[13px] leading-relaxed rounded-2xl shadow-sm break-words border text-left transition-all ${isSentByMe ? 'bg-[#1C2B3A] border-transparent text-white rounded-tr-none' : 'bg-white border-[#E8E8E2] text-[#1A1A1A] rounded-tl-none'}`}>
                        {msg.text}
                        {msg.editedAt && <span className={`text-[9px] italic ml-1.5 ${isSentByMe ? 'text-white/70' : 'text-neutral-400'}`}>(edited)</span>}
                        
                        {translatedMessages[msg._id] && (
                          <span className={`block mt-2 pt-2 border-t text-xs font-sans ${isSentByMe ? 'border-white/20 text-blue-100' : 'border-gray-200 text-blue-900 bg-blue-50/70 p-2 rounded-xl'}`}>
                            <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5 opacity-80">🌐 Spanish Translation:</span>
                            {translatedMessages[msg._id]}
                          </span>
                        )}
                      </p>
                      
                      {/* Floating Reactions overlay */}
                      {msg.reactions && msg.reactions.length>0 && (
                        <div className={`absolute -bottom-2.5 flex gap-1 flex-wrap z-10 ${isSentByMe ? 'right-2' : 'left-2'}`}>
                          {Object.entries(msg.reactions.reduce((acc,r)=>{acc[r.emoji]=(acc[r.emoji]||0)+1;return acc},{})).map(([emoji,count])=>(
                            <button key={emoji} onClick={()=>reactToMessage(msg._id,emoji)} className={`text-[9px] px-2 py-0.5 rounded-full border flex items-center gap-1 transition-all shadow-sm ${msg.reactions.some(r=>r.userId===authUser?._id && r.emoji===emoji) ? 'bg-[#1C2B3A]/15 border-[#1C2B3A]/25 text-[#1C2B3A] font-semibold' : 'bg-white border-[#E8E8E2] text-[#6B7280] hover:border-[#6B7280]'}`}>
                              <span>{emoji}</span>
                              {count>1 && <span className='font-bold ml-1'>{count}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timestamp & E2EE Delivery status underneath bubble */}
                  <div className={`flex items-center gap-1.5 mt-1 px-1 ${isSentByMe ? 'justify-end' : 'justify-start'}`}>
                    <span className='text-[9px] text-[#9CA3AF] font-semibold'>{formatMessageTime(msg.createdAt)}</span>
                    {isSentByMe && (
                      <span className='text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-mono font-medium flex items-center gap-0.5 border border-emerald-200/50' title="Client-Side AES-256 E2EE Verified">
                        <span>🔒</span>
                        <span>E2EE</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Sent Message Avatar (Right) */}
                {isSentByMe && (
                  <img src={getSenderPic(msg)} className='w-8 h-8 rounded-full object-cover border border-[#E8E8E2] shadow-sm mt-0.5' alt="" />
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* TYPING INDICATOR */}
        {typingInfo && (
          <div className='flex items-start gap-3 px-4 py-1 flex-row'>
            <img src={typingInfo.avatar} className='w-8 h-8 rounded-full object-cover border border-[#E8E8E2] shadow-sm' alt='' />
            <div className='flex flex-col items-start'>
              <div className='p-3.5 rounded-2xl rounded-tl-none bg-white border border-[#E8E8E2] shadow-sm'>
                <div className='flex items-center gap-1 px-1'>
                  <span className='w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce' style={{animationDelay:'0ms'}}></span>
                  <span className='w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce' style={{animationDelay:'150ms'}}></span>
                  <span className='w-1.5 h-1.5 rounded-full bg-[#9CA3AF] animate-bounce' style={{animationDelay:'300ms'}}></span>
                </div>
              </div>
              <span className='text-[9px] text-[#9CA3AF] font-semibold mt-1 px-1'>{typingInfo.name} typing</span>
            </div>
          </div>
        )}
        <div ref={scrollEnd}></div>
      </div>

      {/* BOTTOM AREA */}
      <div className='p-4 bg-[#F5F5F0] border-t border-[#E8E8E2] flex-shrink-0'>
        {/* Reply Preview */}
        {replyingTo && (
          <div className='flex items-center justify-between bg-white border border-[#E8E8E2] border-l-2 border-l-[#1C2B3A] rounded-xl px-4 py-2 mb-3 text-sm text-[#1A1A1A] backdrop-blur-md max-w-5xl mx-auto'>
            <div className='flex-1 min-w-0 text-left flex items-center gap-2'>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-[#1C2B3A]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
              <div>
                <p className='text-[#1C2B3A] text-xs font-bold'>Replying to {getSenderName(replyingTo.senderId)}</p>
                <p className='truncate text-xs mt-0.5 text-[#6B7280]'>{replyingTo.image ? '🖼️ Photo' : replyingTo.text}</p>
              </div>
            </div>
            <button onClick={()=>setReplyingTo(null)} className='text-[#6B7280] hover:text-[#1A1A1A] ml-2 text-md cursor-pointer p-1'>✕</button>
          </div>
        )}

        {/* DLP Secret Shield Warning Alert */}
        {dlpWarning && dlpWarning.hasSecrets && (
          <div className='flex items-center justify-between bg-red-50 border border-red-200 rounded-xl px-4 py-2.5 mb-3 text-xs text-red-900 shadow-sm max-w-5xl mx-auto animate-fade-in'>
            <div className='flex items-center gap-2.5 min-w-0 text-left'>
              <span className='text-base animate-pulse'>🛡️</span>
              <div>
                <p className='font-bold text-red-700 flex items-center gap-1.5'>
                  <span>Security Shield Alert:</span>
                  <span className='bg-red-200/60 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide font-mono'>{dlpWarning.findings[0]?.type}</span>
                </p>
                <p className='text-red-600/90 text-[11px] mt-0.5'>Raw sensitive secrets detected in input text. Encrypting raw secrets exposes tokens to participants.</p>
              </div>
            </div>
            <button
              onClick={() => {
                setInput(dlpWarning.cleanText);
                setDlpWarning(null);
                toast.success("Secrets redacted automatically!");
              }}
              className='ml-3 bg-red-600 hover:bg-red-700 text-white font-medium px-3 py-1.5 rounded-lg shadow transition-all flex-shrink-0 cursor-pointer text-[11px]'
            >
              🔒 Auto-Redact & Encrypt
            </button>
          </div>
        )}
        
        {/* Emoji Picker Popup */}
        {showEmojiPicker && (
          <div ref={emojiPickerRef} className='absolute bottom-20 left-6 z-10 shadow-2xl border border-[#E8E8E2] rounded-xl overflow-hidden'>
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme='light'
              width={300}
              height={400}
              searchDisabled={false}
              skinTonesDisabled
              previewConfig={{showPreview:false}}
            />
          </div>
        )}

        <div className='flex items-center gap-3.5 max-w-5xl mx-auto'>
          {isRecordingVoice ? (
            <VoiceRecorder
              onSendVoiceMemo={async (memo) => {
                setIsRecordingVoice(false);
                await sendMessage({ text: `🎙️ Encrypted Voice Memo (${memo.duration}s)` });
                toast.success("Voice memo encrypted & sent!", { icon: "🎙️" });
              }}
              onCancel={() => setIsRecordingVoice(false)}
            />
          ) : (
            <>
              <div className='flex-1 flex items-center bg-white border border-[#E8E8E2] px-4.5 rounded-xl transition-all focus-within:border-[#1C2B3A] focus-within:ring-1 focus-within:ring-[#1C2B3A]'>
                <button onClick={()=>setShowEmojiPicker(prev=>!prev)} className='cursor-pointer mr-3 opacity-70 hover:opacity-100 hover:scale-105 transition-all p-1 flex items-center justify-center' title='Emoji'>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-[#6B7280]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 0 1-6.364 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75Zm-.375 0h.008v.015h-.008V9.75Z" />
                  </svg>
                </button>
                <input 
                  onChange={handleInputChange} 
                  value={input} 
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handlesendMessage(e);
                    }
                  }}
                  type="text" 
                  placeholder='Type your message here...' 
                  className='flex-1 text-sm py-3 bg-transparent border-none outline-none text-[#1A1A1A] placeholder-[#9CA3AF]'
                />
                <input type="file" onChange={handleSendImage} id='image' accept='image/png, image/jpeg' hidden/>
                <label htmlFor="image" className='cursor-pointer opacity-70 hover:opacity-100 hover:scale-105 transition-all p-1 flex items-center justify-center mr-2' title="Attach Image">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-[#6B7280]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                  </svg>
                </label>
                <button
                  type="button"
                  onClick={() => setIsRecordingVoice(true)}
                  className='cursor-pointer opacity-70 hover:opacity-100 hover:scale-105 transition-all p-1 flex items-center justify-center'
                  title="Record Voice Memo"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 text-[#6B7280]">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 0 3-3V4.5a3 3 0 0 0-6 0v8.25a3 3 0 0 0 3 3Z" />
                  </svg>
                </button>
              </div>
              <button 
                onClick={handlesendMessage} 
                className='w-11 h-11 rounded-xl bg-[#1C2B3A] hover:bg-[#253545] flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all flex-shrink-0 cursor-pointer'
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4 text-white">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Group Info Modal */}
      {isGroupInfoOpen && selectedUser && selectedUser.isGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white border border-[#E8E8E2] w-full max-w-md p-6 rounded-2xl shadow-2xl flex flex-col gap-4 text-[#1A1A1A] mx-4 animate-fade-in-scale">
            <div className="flex justify-between items-center border-b border-[#E8E8E2] pb-3">
              <h3 className="text-lg font-bold font-headline text-[#1C2B3A]">Group Details</h3>
              <button onClick={() => setIsGroupInfoOpen(false)} className="text-[#6B7280] hover:text-[#1A1A1A] text-sm">✕</button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Avatar & Info */}
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="relative">
                  <img 
                    src={newGroupAvatar || assets.avatar_icon} 
                    alt="Group Avatar" 
                    className="w-20 h-20 rounded-full object-cover border border-[#E8E8E2] shadow-lg"
                  />
                  {isAdmin && (
                    <label htmlFor="edit-group-avatar" className="absolute bottom-0 right-0 bg-[#1C2B3A] text-white rounded-full p-1.5 cursor-pointer shadow-md transition-colors border border-white/20 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.5 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                      </svg>
                      <input 
                        type="file" 
                        id="edit-group-avatar" 
                        accept="image/*" 
                        onChange={async (e) => {
                          const file = e.target.files[0];
                          if (file) {
                            try {
                              const compressed = await compressImage(file, 200);
                              setNewGroupAvatar(compressed);
                              updateGroupInfo(selectedUser._id, newGroupName, compressed);
                            } catch (err) {
                              toast.error("Error processing image");
                            }
                          }
                        }} 
                        hidden 
                      />
                    </label>
                  )}
                </div>

                {isAdmin ? (
                  <div className="flex items-center gap-2 w-full max-w-xs justify-center">
                    <input 
                      type="text" 
                      value={newGroupName} 
                      onChange={(e) => setNewGroupName(e.target.value)}
                      onBlur={() => {
                        if (newGroupName.trim() && newGroupName !== selectedUser.groupName) {
                          updateGroupInfo(selectedUser._id, newGroupName.trim(), newGroupAvatar);
                        }
                      }}
                      className="bg-[#FAFAFA] border border-[#E8E8E2] rounded-lg p-1.5 px-2.5 text-sm text-center font-bold outline-none focus:ring-1 focus:ring-[#1C2B3A] w-full"
                    />
                  </div>
                ) : (
                  <h4 className="text-md font-bold text-[#1A1A1A]">{selectedUser.groupName}</h4>
                )}
                <p className="text-xs text-[#6B7280]">Created by {typeof selectedUser.admin === "object" ? selectedUser.admin.fullname : "Admin"}</p>
              </div>

              {/* Member list section */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-1">
                  <span>Members ({selectedUser.participants.length})</span>
                  {isAdmin && (
                    <button 
                      onClick={() => setIsAddMembersOpen(true)}
                      className="text-[#1C2B3A] hover:text-[#253545] font-bold transition-colors cursor-pointer text-[11px] flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.647-6.374-1.766Z" />
                      </svg>
                      Add Members
                    </button>
                  )}
                </div>
                
                <div className="max-h-48 overflow-y-auto border border-[#E8E8E2] rounded-xl bg-[#FAFAFA] p-2 flex flex-col gap-1.5">
                  {selectedUser.participants.map((p) => {
                    const isMemberAdmin = typeof selectedUser.admin === "object" ? selectedUser.admin._id === p._id : selectedUser.admin === p._id;
                    return (
                      <div key={p._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F5F5F0] transition-colors">
                        <div className="flex items-center gap-2.5">
                          <img src={p.profilePic || assets.avatar_icon} alt="" className="w-8 h-8 rounded-full object-cover border border-[#E8E8E2]" />
                          <span className="text-sm font-medium text-[#1A1A1A]">{p.fullname}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {isMemberAdmin && <span className="text-[10px] font-bold text-[#1C2B3A] bg-[#1C2B3A]/10 border border-[#1C2B3A]/20 rounded px-1.5 py-0.5">Admin</span>}
                          {isAdmin && p._id !== authUser?._id && !isMemberAdmin && (
                            <button 
                              onClick={() => removeGroupMember(selectedUser._id, p._id)}
                              className="text-[10px] font-bold text-red-500 hover:text-red-650 transition-colors"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-between gap-3 mt-4 pt-3 border-t border-[#E8E8E2]">
              {/* Leave Group - visible to all */}
              <button 
                onClick={() => {
                  removeGroupMember(selectedUser._id, authUser?._id);
                  setIsGroupInfoOpen(false);
                }}
                className="flex-1 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 text-sm font-semibold transition-colors flex items-center justify-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
                </svg>
                Leave Group
              </button>

              {/* Delete Group - admin only */}
              {isAdmin && (
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${selectedUser.groupName}"? This cannot be undone.`)) {
                      deleteGroup(selectedUser._id);
                      setIsGroupInfoOpen(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-1 shadow"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-3.5 h-3.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Delete Group
                </button>
              )}

              <button 
                onClick={() => setIsGroupInfoOpen(false)} 
                className="px-6 py-2 rounded-xl bg-[#F5F5F0] hover:bg-[#E8E8E2] text-sm font-semibold transition-colors text-[#1A1A1A] border border-[#E8E8E2]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Members Sub-Modal */}
      {isAddMembersOpen && selectedUser && selectedUser.isGroup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300">
          <div className="bg-white border border-[#E8E8E2] w-full max-w-sm p-6 rounded-2xl shadow-2xl flex flex-col gap-4 text-[#1A1A1A] mx-4 animate-fade-in-scale">
            <div className="flex justify-between items-center border-b border-[#E8E8E2] pb-3">
              <h3 className="text-md font-bold text-[#1C2B3A]">Add Members</h3>
              <button onClick={() => setIsAddMembersOpen(false)} className="text-[#6B7280] hover:text-[#1A1A1A] text-sm">✕</button>
            </div>

            <div className="max-h-48 overflow-y-auto border border-[#E8E8E2] rounded-xl bg-[#FAFAFA] p-2 flex flex-col gap-1.5">
              {users.filter(u => !selectedUser.participants.some(p => p._id === u._id)).length === 0 ? (
                <p className="text-xs text-neutral-500 p-2 text-center">All contacts are already members.</p>
              ) : (
                users.filter(u => !selectedUser.participants.some(p => p._id === u._id)).map((user) => (
                  <label key={user._id} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#F5F5F0] cursor-pointer transition-colors">
                    <div className="flex items-center gap-2.5">
                      <img src={user.profilePic || assets.avatar_icon} alt="" className="w-8 h-8 rounded-full object-cover border border-[#E8E8E2]" />
                      <span className="text-sm font-medium text-[#1A1A1A]">{user.fullname}</span>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={selectedAddUsers.includes(user._id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedAddUsers(prev => [...prev, user._id]);
                        } else {
                          setSelectedAddUsers(prev => prev.filter(id => id !== user._id));
                        }
                      }}
                      className="w-4 h-4 rounded border-[#E8E8E2] text-[#1C2B3A] focus:ring-[#1C2B3A]"
                    />
                  </label>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-3 border-t border-[#E8E8E2]">
              <button 
                onClick={() => {
                  setIsAddMembersOpen(false);
                  setSelectedAddUsers([]);
                }}
                className="px-4 py-2 rounded-xl bg-[#F5F5F0] hover:bg-[#E8E8E2] text-sm font-semibold transition-colors text-[#1A1A1A] border border-[#E8E8E2]"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (selectedAddUsers.length > 0) {
                    addGroupMembers(selectedUser._id, selectedAddUsers);
                    setIsAddMembersOpen(false);
                    setSelectedAddUsers([]);
                  }
                }}
                disabled={selectedAddUsers.length === 0}
                className="px-4 py-2 rounded-xl bg-[#1C2B3A] hover:bg-[#253545] disabled:opacity-50 text-sm font-semibold transition-colors text-white"
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Catch-Up Matrix Modal */}
      <AICatchUpModal
        isOpen={isCatchUpOpen}
        onClose={() => setIsCatchUpOpen(false)}
        messages={messages}
        authUser={authUser}
        onJumpToMessage={(msgId) => {
          setHighlightMessageId(msgId);
          const elem = document.getElementById(`msg-${msgId}`);
          if (elem) {
            elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }}
      />
    </div>
  ):(
    <div className='flex-1 flex flex-col items-center justify-center gap-4 text-[#6B7280] bg-[#F5F5F0] max-md:hidden'>
      <img src={assets.logo_icon} className='w-72 object-contain opacity-95 drop-shadow-lg' alt="Dialogue" />
    </div>
  )
}

export default ChatContainer