/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Mic, 
  MicOff, 
  Activity, 
  Cpu, 
  Shield, 
  Zap, 
  Terminal,
  Wifi,
  Cloud,
  MessageSquare,
  Volume2,
  Image as ImageIcon,
  Video as VideoIcon,
  Send,
  Loader2,
  Upload,
  Download,
  Key,
  Trash2,
  CheckCircle,
  Circle,
  ListTodo,
  Plus,
  User
} from 'lucide-react';
import { JarvisVoiceService } from './services/jarvisService';
import { JarvisChatService } from './services/chatService';
import { JarvisMediaService } from './services/mediaService';
import { cn } from './lib/utils';
import ReactMarkdown from 'react-markdown';

const API_KEY = process.env.GEMINI_API_KEY || '';

type Tab = 'voice' | 'tactical' | 'media' | 'tasks';

interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
  priority: 'low' | 'high';
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('voice');
  const [status, setStatus] = useState<'Offline' | 'Online' | 'Connecting' | 'Error'>('Offline');
  const [messages, setMessages] = useState<{ role: 'jarvis' | 'user', text: string }[]>([]);
  const [volume, setVolume] = useState(0);
  const [systemStats, setSystemStats] = useState({ cpu: 12, memory: 45, power: 98, temp: 34 });
  const [logs, setLogs] = useState<string[]>([]);
  
  // Tactical Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model', parts: { text: string }[] }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Media Lab State
  const [mediaPrompt, setMediaPrompt] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaResult, setMediaResult] = useState<{ type: 'image' | 'video', url: string } | null>(null);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [mediaLoadingStatus, setMediaLoadingStatus] = useState('');
  const [hasVeoKey, setHasVeoKey] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [isQuickStatusLoading, setIsQuickStatusLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskInput, setTaskInput] = useState('');
  const [taskPriority, setTaskPriority] = useState<'low' | 'high'>('low');
  const [userName, setUserName] = useState('Tony Stark');
  const [preferredGreeting, setPreferredGreeting] = useState('Sir');

  const jarvisRef = useRef<JarvisVoiceService | null>(null);
  const chatServiceRef = useRef<JarvisChatService | null>(null);
  const mediaServiceRef = useRef<JarvisMediaService | null>(null);
  const logsScrollRef = useRef<HTMLDivElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const hasPromptedVoiceRef = useRef(false);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setHasVeoKey(hasKey);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (activeTab === 'voice' && status === 'Online' && jarvisRef.current) {
      if (!hasPromptedVoiceRef.current) {
        const activeTasks = tasks.filter(t => !t.completed).map(t => t.text).join(', ');
        const taskContext = activeTasks ? ` Current Mission Objectives: ${activeTasks}.` : " No active mission objectives.";
        const context = `User Profile: Name is ${userName}, Preferred Greeting is ${preferredGreeting}. System Status: CPU ${systemStats.cpu}%, Memory ${systemStats.memory}%, Power ${systemStats.power.toFixed(1)}%, Temp ${systemStats.temp}°C. Recent Logs: ${logs.slice(-3).join(' | ')}.${taskContext} Please provide a brief, witty status update addressed to the user using their preferred greeting, based on these metrics and objectives.`;
        jarvisRef.current.sendText(context);
        addLog(`Transmitting system context to Voice Core for ${userName}...`);
        hasPromptedVoiceRef.current = true;
      }
    } else if (activeTab !== 'voice') {
      hasPromptedVoiceRef.current = false;
    }
  }, [activeTab, status, tasks]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStats(prev => ({
        cpu: Math.floor(Math.random() * 20) + 5,
        memory: Math.floor(Math.random() * 10) + 40,
        power: Math.max(0, prev.power - 0.01),
        temp: Math.floor(Math.random() * 5) + 32
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (logsScrollRef.current) logsScrollRef.current.scrollTop = logsScrollRef.current.scrollHeight;
    if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [messages, chatHistory, logs]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleToggleConnection = async () => {
    if (status === 'Online') {
      jarvisRef.current?.disconnect();
      setStatus('Offline');
      setIsMuted(false);
      addLog("System disconnected.");
    } else {
      setStatus('Connecting');
      addLog("Initializing J.A.R.V.I.S. protocols...");
      if (!jarvisRef.current) jarvisRef.current = new JarvisVoiceService(API_KEY);
      try {
        await jarvisRef.current.connect({
          onMessage: (text) => setMessages(prev => [...prev, { role: 'jarvis', text }]),
          onStatusChange: (s) => {
            setStatus(s as any);
            if (s === 'Online') addLog("J.A.R.V.I.S. is now operational.");
          },
          onVolumeChange: (v) => setVolume(v),
          onInterrupted: () => addLog("Interruption detected. Recalibrating...")
        });
      } catch (err) {
        setStatus('Error');
        addLog("Initialization failed.");
      }
    }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', parts: [{ text: userMsg }] }]);
    setIsChatLoading(true);
    addLog("Processing tactical query...");

    if (!chatServiceRef.current) chatServiceRef.current = new JarvisChatService(API_KEY);

    try {
      const response = await chatServiceRef.current.sendMessage(userMsg, chatHistory, { name: userName, greeting: preferredGreeting });
      setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: response.text || '' }] }]);
      addLog("Tactical analysis complete.");
    } catch (err) {
      addLog("Error in tactical analysis.");
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearChat = () => {
    setChatHistory([]);
    addLog("Tactical chat history purged.");
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskInput.trim()) return;
    const newTask: Task = {
      id: crypto.randomUUID(),
      text: taskInput.trim(),
      completed: false,
      createdAt: Date.now(),
      priority: taskPriority
    };
    setTasks(prev => [newTask, ...prev]);
    setTaskInput('');
    setTaskPriority('low');
    addLog(`${taskPriority === 'high' ? 'CRITICAL ' : ''}Mission objective recorded: ${newTask.text}`);
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const newState = !t.completed;
        addLog(newState ? `Objective complete: ${t.text}` : `Objective reactivated: ${t.text}`);
        return { ...t, completed: newState };
      }
      return t;
    }));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => {
      const task = prev.find(t => t.id === id);
      if (task) addLog(`Objective purged: ${task.text}`);
      return prev.filter(t => t.id !== id);
    });
  };

  const handleMediaAction = async (action: 'edit' | 'video') => {
    if (!mediaPrompt.trim() || isMediaLoading) return;
    
    setIsMediaLoading(true);
    setMediaLoadingStatus(action === 'edit' ? "Editing image..." : "Generating video with Veo...");
    addLog(action === 'edit' ? "Initiating image manipulation..." : "Initiating Veo video synthesis...");

    if (!mediaServiceRef.current) mediaServiceRef.current = new JarvisMediaService(API_KEY);

    try {
      if (action === 'edit') {
        if (!selectedFile) throw new Error("No image selected");
        const buffer = await selectedFile.arrayBuffer();
        const result = await mediaServiceRef.current.editImage(buffer, mediaPrompt, selectedFile.type);
        setMediaResult({ type: 'image', url: result });
      } else {
        if (!hasVeoKey) {
          await window.aistudio.openSelectKey();
          setHasVeoKey(true);
        }
        
        let buffer: ArrayBuffer | undefined;
        if (selectedFile) buffer = await selectedFile.arrayBuffer();
        
        const downloadLink = await mediaServiceRef.current.generateVideo(mediaPrompt, buffer, selectedFile?.type, aspectRatio);
        
        // Fetch video with API key
        const response = await fetch(downloadLink, {
          headers: { 'x-goog-api-key': API_KEY }
        });
        const blob = await response.blob();
        const videoUrl = URL.createObjectURL(blob);
        setMediaResult({ type: 'video', url: videoUrl });
      }
      addLog("Media synthesis successful.");
    } catch (err) {
      addLog(`Media error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsMediaLoading(false);
      setMediaLoadingStatus('');
    }
  };

  const handleQuickStatus = async () => {
    if (isQuickStatusLoading) return;
    setIsQuickStatusLoading(true);
    addLog("Requesting rapid system diagnostic...");
    
    if (!chatServiceRef.current) chatServiceRef.current = new JarvisChatService(API_KEY);
    
    try {
      const stats = `CPU: ${systemStats.cpu}%, RAM: ${systemStats.memory}%, Power: ${systemStats.power.toFixed(1)}%, Temp: ${systemStats.temp}°C. Status: ${status}.`;
      const response = await chatServiceRef.current.fastResponse(`Current system metrics: ${stats}. Provide a witty, one-sentence JARVIS-style status update.`);
      addLog(`JARVIS: ${response}`);
    } catch (err) {
      addLog("Diagnostic failed.");
    } finally {
      setIsQuickStatusLoading(false);
    }
  };

  const handleToggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    jarvisRef.current?.setMuted(newMuteState);
    addLog(newMuteState ? "Microphone input suppressed." : "Microphone input active.");
  };

  return (
    <div className="h-screen w-screen bg-jarvis-bg text-white font-sans flex flex-col p-6 overflow-hidden relative">
      <div className="absolute inset-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle, #00f2ff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <header className="flex justify-between items-center mb-6 z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-jarvis-cyan flex items-center justify-center jarvis-border-glow">
            <Activity className="text-jarvis-cyan w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="font-display text-2xl tracking-widest text-jarvis-cyan jarvis-text-glow">J.A.R.V.I.S.</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-jarvis-cyan/60">Advanced Intelligence System</p>
          </div>
        </div>
        
        <div className="flex gap-4">
          <TabButton active={activeTab === 'voice'} onClick={() => setActiveTab('voice')} icon={<Mic className="w-4 h-4" />} label="Voice Core" />
          <TabButton active={activeTab === 'tactical'} onClick={() => setActiveTab('tactical')} icon={<MessageSquare className="w-4 h-4" />} label="Tactical Chat" />
          <TabButton active={activeTab === 'media'} onClick={() => setActiveTab('media')} icon={<ImageIcon className="w-4 h-4" />} label="Media Lab" />
          <TabButton active={activeTab === 'tasks'} onClick={() => setActiveTab('tasks')} icon={<ListTodo className="w-4 h-4" />} label="Mission Log" />
        </div>

        <div className="flex gap-6 items-center">
          {status === 'Online' && (
            <button 
              onClick={handleToggleMute}
              className={cn(
                "p-3 rounded-full transition-all duration-300 border",
                isMuted ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-jarvis-cyan/10 border-jarvis-cyan/30 text-jarvis-cyan"
              )}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
          <button onClick={handleToggleConnection} className={cn("p-4 rounded-full transition-all duration-500 border jarvis-border-glow", status === 'Online' ? "bg-jarvis-cyan/20 border-jarvis-cyan" : "bg-red-500/20 border-red-500/50")}>
            {status === 'Online' ? <Mic className="text-jarvis-cyan" /> : <MicOff className="text-red-400" />}
          </button>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-12 gap-6 z-10 overflow-hidden">
        {/* Left Panel: System Stats */}
        <div className="col-span-3 flex flex-col gap-6 overflow-hidden">
          <div className="jarvis-panel flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-jarvis-cyan" />
              <h2 className="font-display text-xs tracking-widest uppercase">System Integrity</h2>
            </div>
            
            <div className="space-y-4">
              <StatBar label="CPU LOAD" value={systemStats.cpu} icon={<Cpu className="w-3 h-3" />} />
              <StatBar label="MEMORY" value={systemStats.memory} icon={<Activity className="w-3 h-3" />} />
              <StatBar label="POWER" value={systemStats.power} icon={<Zap className="w-3 h-3" />} color="text-jarvis-orange" />
              <StatBar label="THERMAL" value={systemStats.temp} max={100} icon={<Cloud className="w-3 h-3" />} />
            </div>

            <div className="mt-6 p-3 border border-jarvis-cyan/10 bg-jarvis-cyan/5 rounded">
              <h3 className="text-[10px] font-display tracking-widest text-jarvis-cyan mb-3 uppercase flex items-center gap-2">
                <User className="w-3 h-3" />
                User Profile
              </h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[8px] uppercase tracking-widest text-jarvis-cyan/40">Identity</label>
                  <input 
                    value={userName} 
                    onChange={e => setUserName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-jarvis-cyan/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[8px] uppercase tracking-widest text-jarvis-cyan/40">Protocol Address</label>
                  <input 
                    value={preferredGreeting} 
                    onChange={e => setPreferredGreeting(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 text-[10px] font-mono focus:outline-none focus:border-jarvis-cyan/50"
                  />
                </div>
              </div>
            </div>

            <div className="mt-6 p-3 border border-jarvis-cyan/10 bg-jarvis-cyan/5 rounded">
              <h3 className="text-[10px] font-display tracking-widest text-jarvis-cyan mb-2 uppercase">Active Modules</h3>
              <ul className="text-[9px] font-mono text-jarvis-cyan/60 space-y-1">
                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-jarvis-cyan rounded-full" /> Gemini 3.1 Pro Tactical</li>
                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-jarvis-cyan rounded-full" /> Veo 3.1 Fast Synthesis</li>
                <li className="flex items-center gap-2"><div className="w-1 h-1 bg-jarvis-cyan rounded-full" /> Flash 2.5 Image Lab</li>
              </ul>
              <button 
                onClick={handleQuickStatus}
                disabled={isQuickStatusLoading}
                className="mt-4 w-full py-2 bg-jarvis-cyan/10 border border-jarvis-cyan/20 rounded text-[8px] font-display tracking-[0.2em] uppercase text-jarvis-cyan hover:bg-jarvis-cyan/20 transition-colors flex items-center justify-center gap-2"
              >
                {isQuickStatusLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                Quick Diagnostic
              </button>
            </div>

            <div className="mt-auto pt-4 border-t border-jarvis-cyan/10">
              <div className="flex items-center gap-2 mb-2">
                <Terminal className="w-3 h-3 text-jarvis-cyan/60" />
                <span className="text-[10px] uppercase tracking-widest text-jarvis-cyan/60">System Logs</span>
              </div>
              <div ref={logsScrollRef} className="font-mono text-[9px] text-jarvis-cyan/40 space-y-1 h-24 overflow-y-auto custom-scrollbar">
                {logs.map((log, i) => <div key={i} className="truncate">{log}</div>)}
              </div>
            </div>
          </div>
        </div>

        {/* Center: Main Module View */}
        <div className="col-span-9 flex flex-col gap-6 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'voice' && (
              <motion.div key="voice" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col items-center justify-center relative">
                <div className="relative w-64 h-64 flex items-center justify-center">
                  <motion.div 
                    animate={{ 
                      rotate: 360,
                      scale: volume > 0.01 ? [1, 1.05, 1] : 1,
                      opacity: volume > 0.01 ? [0.2, 0.5, 0.2] : 0.2
                    }} 
                    transition={{ 
                      rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                      scale: { duration: 1, repeat: Infinity, ease: "easeInOut" },
                      opacity: { duration: 1, repeat: Infinity, ease: "easeInOut" }
                    }} 
                    className="absolute inset-0 border border-dashed border-jarvis-cyan rounded-full" 
                  />
                  <motion.div 
                    animate={{ 
                      boxShadow: volume > 0.01 
                        ? [
                            "0 0 15px rgba(0, 242, 255, 0.2)", 
                            "0 0 30px rgba(0, 242, 255, 0.5)", 
                            "0 0 15px rgba(0, 242, 255, 0.2)"
                          ] 
                        : "0 0 15px rgba(0, 242, 255, 0.2)",
                      borderColor: volume > 0.01 ? "rgba(0, 242, 255, 0.6)" : "rgba(0, 242, 255, 0.3)"
                    }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    className="relative w-40 h-40 rounded-full bg-jarvis-bg border flex items-center justify-center"
                  >
                    <div className="flex items-end gap-1.5 h-16">
                      {[...Array(12)].map((_, i) => (
                        <motion.div 
                          key={i} 
                          animate={{ 
                            height: status === 'Online' 
                              ? Math.max(4, volume * (40 + Math.random() * 40) * (1 - Math.abs(i - 5.5) / 6)) 
                              : 4 
                          }} 
                          transition={{
                            type: "spring",
                            stiffness: 300,
                            damping: 15,
                            mass: 0.5
                          }}
                          className="w-1.5 bg-jarvis-cyan rounded-full shadow-[0_0_10px_rgba(0,242,255,0.5)]" 
                        />
                      ))}
                    </div>
                  </motion.div>
                </div>
                <div className="mt-8 w-full max-w-lg text-center">
                  {messages.length > 0 && (
                    <div className="text-jarvis-cyan/80 font-mono text-sm leading-relaxed jarvis-text-glow italic">
                      "{messages[messages.length - 1].text}"
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {activeTab === 'tactical' && (
              <motion.div key="tactical" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col jarvis-panel">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-jarvis-cyan" />
                    <h2 className="font-display text-xs tracking-widest uppercase">Tactical Interface</h2>
                  </div>
                  {chatHistory.length > 0 && (
                    <button 
                      onClick={handleClearChat}
                      className="p-1.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors"
                      title="Clear History"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar">
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={cn("p-4 rounded border font-mono text-sm", msg.role === 'model' ? "bg-jarvis-cyan/5 border-jarvis-cyan/20 text-jarvis-cyan" : "bg-white/5 border-white/10 text-white/80")}>
                      <div className="text-[10px] uppercase tracking-widest mb-2 opacity-50">{msg.role === 'model' ? 'J.A.R.V.I.S.' : 'USER'}</div>
                      <div className="prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown>{msg.parts[0].text}</ReactMarkdown>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && <div className="flex items-center gap-2 text-jarvis-cyan animate-pulse"><Loader2 className="w-4 h-4 animate-spin" /> Analyzing...</div>}
                </div>
                <form onSubmit={handleChatSubmit} className="flex gap-2">
                  <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Enter tactical query..." className="flex-1 bg-white/5 border border-white/10 rounded px-4 py-2 text-sm focus:outline-none focus:border-jarvis-cyan/50 font-mono" />
                  <button type="submit" disabled={isChatLoading} className="p-2 bg-jarvis-cyan/20 border border-jarvis-cyan/40 rounded text-jarvis-cyan hover:bg-jarvis-cyan/30 transition-colors">
                    <Send className="w-5 h-5" />
                  </button>
                </form>
              </motion.div>
            )}

            {activeTab === 'media' && (
              <motion.div key="media" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 grid grid-cols-2 gap-6 overflow-hidden">
                <div className="jarvis-panel flex flex-col gap-4">
                  <div className="flex items-center gap-2 mb-2">
                    <ImageIcon className="w-4 h-4 text-jarvis-cyan" />
                    <h3 className="font-display text-xs tracking-widest uppercase">Input Parameters</h3>
                  </div>
                  
                  <div className="flex-1 flex flex-col gap-4">
                    <label className="flex-1 border-2 border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-jarvis-cyan/30 transition-colors p-4 relative overflow-hidden">
                      <input type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} accept="image/*" />
                      {selectedFile ? (
                        <div className="text-center">
                          <ImageIcon className="w-12 h-12 text-jarvis-cyan mx-auto mb-2" />
                          <p className="text-xs font-mono text-jarvis-cyan">{selectedFile.name}</p>
                        </div>
                      ) : (
                        <div className="text-center opacity-40">
                          <Upload className="w-12 h-12 mx-auto mb-2" />
                          <p className="text-xs font-mono">Upload Reference Image</p>
                        </div>
                      )}
                    </label>
                    
                    <textarea value={mediaPrompt} onChange={e => setMediaPrompt(e.target.value)} placeholder="Describe manipulation or video synthesis..." className="h-32 bg-white/5 border border-white/10 rounded p-3 text-sm focus:outline-none focus:border-jarvis-cyan/50 font-mono resize-none" />
                    
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] uppercase tracking-widest text-jarvis-cyan/40">Aspect Ratio</span>
                      <div className="flex gap-2">
                        <button onClick={() => setAspectRatio('16:9')} className={cn("px-2 py-1 text-[9px] border rounded transition-colors", aspectRatio === '16:9' ? "bg-jarvis-cyan/20 border-jarvis-cyan text-jarvis-cyan" : "border-white/10 text-white/40")}>16:9</button>
                        <button onClick={() => setAspectRatio('9:16')} className={cn("px-2 py-1 text-[9px] border rounded transition-colors", aspectRatio === '9:16' ? "bg-jarvis-cyan/20 border-jarvis-cyan text-jarvis-cyan" : "border-white/10 text-white/40")}>9:16</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => handleMediaAction('edit')} disabled={isMediaLoading || !selectedFile} className="flex items-center justify-center gap-2 py-3 bg-jarvis-cyan/10 border border-jarvis-cyan/30 rounded text-xs font-display tracking-widest uppercase hover:bg-jarvis-cyan/20 disabled:opacity-50">
                        <ImageIcon className="w-4 h-4" /> Edit Image
                      </button>
                      <button onClick={() => handleMediaAction('video')} disabled={isMediaLoading} className="flex items-center justify-center gap-2 py-3 bg-jarvis-orange/10 border border-jarvis-orange/30 rounded text-xs font-display tracking-widest uppercase hover:bg-jarvis-orange/20 disabled:opacity-50">
                        <VideoIcon className="w-4 h-4" /> Veo Video
                      </button>
                    </div>
                    {!hasVeoKey && (
                      <button onClick={() => window.aistudio.openSelectKey()} className="flex items-center justify-center gap-2 py-2 text-[10px] text-jarvis-orange/60 hover:text-jarvis-orange uppercase tracking-widest">
                        <Key className="w-3 h-3" /> Configure Veo Access
                      </button>
                    )}
                  </div>
                </div>

                <div className="jarvis-panel flex flex-col items-center justify-center relative">
                  {isMediaLoading ? (
                    <div className="text-center">
                      <Loader2 className="w-12 h-12 text-jarvis-cyan animate-spin mx-auto mb-4" />
                      <p className="text-xs font-mono text-jarvis-cyan animate-pulse">{mediaLoadingStatus}</p>
                    </div>
                  ) : mediaResult ? (
                    <div className="w-full h-full flex flex-col">
                      <div className="flex-1 relative rounded overflow-hidden border border-white/10">
                        {mediaResult.type === 'image' ? (
                          <img src={mediaResult.url} className="w-full h-full object-contain" />
                        ) : (
                          <video src={mediaResult.url} controls autoPlay loop className="w-full h-full object-contain" />
                        )}
                      </div>
                      <a href={mediaResult.url} download={mediaResult.type === 'image' ? 'jarvis-edit.png' : 'jarvis-veo.mp4'} className="mt-4 flex items-center justify-center gap-2 py-2 bg-white/5 border border-white/10 rounded text-[10px] font-display tracking-widest uppercase hover:bg-white/10">
                        <Download className="w-3 h-3" /> Download Result
                      </a>
                    </div>
                  ) : (
                    <div className="text-center opacity-20">
                      <Zap className="w-16 h-16 mx-auto mb-4" />
                      <p className="text-xs font-display tracking-widest uppercase">Awaiting Synthesis</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
            {activeTab === 'tasks' && (
              <motion.div key="tasks" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col jarvis-panel">
                <div className="flex items-center gap-2 mb-6">
                  <ListTodo className="w-4 h-4 text-jarvis-cyan" />
                  <h2 className="font-display text-xs tracking-widest uppercase">Mission Objectives</h2>
                </div>

                <form onSubmit={addTask} className="flex flex-col gap-4 mb-6">
                  <div className="flex gap-2">
                    <input 
                      value={taskInput} 
                      onChange={e => setTaskInput(e.target.value)} 
                      placeholder="Identify new objective..." 
                      className="flex-1 bg-white/5 border border-white/10 rounded px-4 py-2 text-sm focus:outline-none focus:border-jarvis-cyan/50 font-mono" 
                    />
                    <button type="submit" className="p-2 bg-jarvis-cyan/20 border border-jarvis-cyan/40 rounded text-jarvis-cyan hover:bg-jarvis-cyan/30 transition-colors">
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-[10px] uppercase tracking-widest text-jarvis-cyan/40">Priority Level:</span>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setTaskPriority('low')} className={cn("px-3 py-1 text-[10px] border rounded transition-all uppercase tracking-widest", taskPriority === 'low' ? "bg-jarvis-cyan/20 border-jarvis-cyan text-jarvis-cyan" : "border-white/10 text-white/40")}>Routine</button>
                      <button type="button" onClick={() => setTaskPriority('high')} className={cn("px-3 py-1 text-[10px] border rounded transition-all uppercase tracking-widest", taskPriority === 'high' ? "bg-red-500/20 border-red-500/40 text-red-400" : "border-white/10 text-white/40")}>Critical</button>
                    </div>
                  </div>
                </form>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {tasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center opacity-20">
                      <Shield className="w-12 h-12 mb-4" />
                      <p className="text-xs font-display tracking-widest uppercase">No active objectives</p>
                    </div>
                  ) : (
                    tasks.map(task => (
                      <motion.div 
                        key={task.id} 
                        layout
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ 
                          opacity: 1, 
                          x: 0,
                          scale: task.completed ? 0.98 : 1
                        }}
                        whileHover={{ scale: 1.01 }}
                        className={cn(
                          "flex items-center gap-4 p-3 rounded border transition-all duration-300",
                          task.completed ? "bg-emerald-500/5 border-emerald-500/20 opacity-60" : "bg-white/5 border-white/10",
                          !task.completed && task.priority === 'high' && "border-red-500/30 bg-red-500/5"
                        )}
                      >
                        <button onClick={() => toggleTask(task.id)} className={cn("relative w-5 h-5 flex items-center justify-center transition-colors", task.completed ? "text-emerald-400" : "text-white/20 hover:text-white/40")}>
                          <AnimatePresence mode="wait">
                            {task.completed ? (
                              <motion.div
                                key="checked"
                                initial={{ scale: 0.5, opacity: 0, rotate: -45 }}
                                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                              >
                                <CheckCircle className="w-5 h-5" />
                              </motion.div>
                            ) : (
                              <motion.div
                                key="unchecked"
                                initial={{ scale: 0.5, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.5, opacity: 0 }}
                              >
                                <Circle className="w-5 h-5" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </button>
                        <div className="flex-1 flex flex-col">
                          <span className={cn("font-mono text-sm transition-colors duration-500 relative inline-block", task.completed ? "text-white/40" : "text-white/90")}>
                            {task.text}
                            {task.completed && (
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: "100%" }}
                                className="absolute top-1/2 left-0 h-[1px] bg-emerald-400/50"
                                transition={{ duration: 0.3, ease: "easeOut" }}
                              />
                            )}
                          </span>
                          {!task.completed && task.priority === 'high' && (
                            <span className="text-[8px] uppercase tracking-[0.2em] text-red-400 mt-1 font-display">Priority: Critical</span>
                          )}
                        </div>
                        <button onClick={() => deleteTask(task.id)} className="text-white/10 hover:text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <footer className="mt-6 flex justify-between items-end z-10">
        <div className="flex gap-8">
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-widest text-jarvis-cyan/40">Location</span>
            <span className="text-xs font-mono text-jarvis-cyan/80">MALIBU, CA</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[8px] uppercase tracking-widest text-jarvis-cyan/40">Time</span>
            <span className="text-xs font-mono text-jarvis-cyan/80">{new Date().toLocaleTimeString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="h-[1px] w-32 bg-gradient-to-r from-transparent to-jarvis-cyan/40" />
          <span className="text-[8px] uppercase tracking-[0.8em] text-jarvis-cyan/40">STARK INDUSTRIES</span>
        </div>
      </footer>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-2 px-4 py-2 rounded border transition-all duration-300 font-display text-[10px] tracking-widest uppercase", active ? "bg-jarvis-cyan/20 border-jarvis-cyan text-jarvis-cyan jarvis-border-glow" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10")}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatBar({ label, value, max = 100, icon, color = "text-jarvis-cyan" }: { label: string, value: number, max?: number, icon: React.ReactNode, color?: string }) {
  const percentage = (value / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[9px] tracking-widest uppercase">
        <div className="flex items-center gap-2 text-jarvis-cyan/60">{icon}<span>{label}</span></div>
        <span className={cn("font-mono", color)}>{Math.round(value)}%</span>
      </div>
      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${percentage}%` }} className={cn("h-full bg-current", color.replace('text-', 'bg-'))} style={{ boxShadow: `0 0 10px currentColor` }} />
      </div>
    </div>
  );
}
