"use client";

import { useState, useEffect, useRef } from 'react';
import api from '../lib/axios'
import { Box, TextField, Button, Typography, CircularProgress, Drawer, IconButton } from '@mui/material'; // ★ Drawer, IconButton 추가
import SendIcon from '@mui/icons-material/Send';
import AddIcon from '@mui/icons-material/Add'; 
import MenuIcon from '@mui/icons-material/Menu'; // ★ 햄버거 메뉴 아이콘 추가
import ReactMarkdown from 'react-markdown';
import QuickReplies from '../components/QuickReplies';

// 1. 데이터 타입 정의
interface ChatRoom {
  id: string;
  title: string;
}

interface ChatMessage {
  id: number;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  createdAt: string;
}

export default function Home() {
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  
  const [input, setInput] = useState(''); 
  const [isLoading, setIsLoading] = useState(false); 
  const [isRoomLoading, setIsRoomLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // ★ 모바일 메뉴 상태

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. 화면 켜질 때 '채팅방 목록' 불러오기
  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const res = await api.get('/api/chat/rooms');
      setRooms(res.data);
      if (res.data.length > 0 && !currentRoomId) {
        setCurrentRoomId(res.data[0].id);
      }
    } catch (error) {
      console.error("방 목록 가져오기 실패:", error);
    }
  };

  // 2. 방 변경 시 대화 기록 불러오기
  useEffect(() => {
    if (!currentRoomId) return;
    const fetchMessages = async () => {
      setIsRoomLoading(true); 
      setMessages([]); 
      try {
        const res = await api.get(`/api/chat/rooms/${currentRoomId}/messages`);
        setMessages(res.data);
      } catch (error) {
        console.error("대화 기록 가져오기 실패:", error);
      }
      finally {
        setIsRoomLoading(false); 
      }
    };
    fetchMessages();
  }, [currentRoomId]);

  // 스크롤 자동 이동 (즉시 이동)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages, isLoading]); 

  // 3. 새 채팅방 만들기
  const handleCreateRoom = async () => {
    const title = prompt("새로운 상담 방의 이름을 입력해주세요:", "새로운 육아 상담");
    if (!title) return;

    try {
      const res = await api.post(`/api/chat/rooms?title=${title}`);
      const newRoom = res.data;
      await fetchRooms();
      setCurrentRoomId(newRoom.id); 
      setIsMobileMenuOpen(false); // ★ 모바일에서 새 방 만들면 메뉴 닫기
    } catch (error) {
      alert("방 생성에 실패했습니다.");
    }
  };

  // 4. 메시지 전송
  const handleSend = async (quickMessage?: string) => { 
    const question = quickMessage || input; 

    if (!question.trim() || isLoading || !currentRoomId) return; 

    setInput(''); 

    const tempUserMessage: ChatMessage = {
      id: Date.now(),
      role: 'USER',
      content: question,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]); 
    setIsLoading(true); 

    try {
      // 백엔드 컨트롤러의 @PostMapping("/message") 주소와 파라미터명(roomId, message)을 완벽히 맞춥니다.
      await api.post(`/api/chat/message?roomId=${currentRoomId}&message=${question}`);
      
      // 메시지 보낸 후 대화 목록 새로고침
      const res = await api.get(`/api/chat/rooms/${currentRoomId}/messages`);
      setMessages(res.data); 
    } catch (error) {
      console.error("메시지 전송 실패:", error);
      alert("앗! 간호사 선생님과 연결이 끊어졌거나, 질문 한도를 초과했어요.");
    } finally {
      setIsLoading(false); 
    }
  };

  // 5. 퀵 리플라이 버튼 클릭 핸들러
  const handleQuickReply = (categoryName: string) => {
    const fullQuestion = `${categoryName}에 대해서 상담하고 싶어요.`;
    handleSend(fullQuestion); 
  };


  // ★ 추가: 사이드바 내용을 별도 변수로 분리 (데스크톱, 모바일 공통 사용)
  const sidebarContent = (
    <Box className="w-64 bg-gray-900 text-white p-4 flex flex-col h-full">
      <Button 
        variant="contained" 
        fullWidth 
        startIcon={<AddIcon />}
        className="bg-gray-700 hover:bg-gray-600 mb-6 text-white py-2 font-bold"
        onClick={handleCreateRoom}
      >
        새 상담 시작
      </Button>

      <Typography variant="overline" className="text-gray-400 mb-2 px-1">
        상담 기록 ({rooms.length}개)
      </Typography>

      <Box className="flex flex-col gap-2 overflow-y-auto pr-1">
        {rooms.map((room) => (
          <Box 
            key={room.id}
            onClick={() => {
              setCurrentRoomId(room.id);
              setIsMobileMenuOpen(false); // ★ 모바일에서 방 이동하면 메뉴 닫기
            }}
            className={`p-3 rounded-lg cursor-pointer text-sm truncate transition-colors ${
              currentRoomId === room.id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700' 
            }`}
          >
            💬 {room.title}
          </Box>
        ))}
      </Box>
    </Box>
  );


  return (
    <Box className="flex flex-row h-screen bg-white">
      
      {/* 🟢 좌측 영역: 데스크톱 사이드바 (md 이상에서만 보임) */}
      <Box className="hidden md:block">
        {sidebarContent}
      </Box>

      {/* 🟢 모바일 Drawer (md 미만에서 햄버거 버튼 누를 때 나타남) */}
      <Drawer
        anchor="left"
        open={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        className="md:hidden"
        PaperProps={{ sx: { width: 256, bgcolor: '#111827' } }} // 사이드바 배경색과 맞춤
      >
        {sidebarContent}
      </Drawer>

      {/* 🔵 우측 영역: 메인 채팅창 */}
     <Box className="flex-1 flex flex-col h-full bg-gray-50 relative overflow-hidden">
        {/* ★ p-4를 p-2 md:p-4 로 변경 (모바일은 여백을 좁게!) */}
        <Box className="max-w-3xl w-full mx-auto flex flex-col h-full p-2 md:p-4">
          
          <Box className="flex justify-between items-center py-4 border-b border-gray-200 mb-4">
            <Box className="flex items-center gap-2">
              {/* ★ 모바일용 햄버거 버튼 (md 미만에서만 보임) */}
              <IconButton 
                className="md:hidden text-gray-700 p-1" 
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <MenuIcon />
              </IconButton>
              <Typography variant="h6" className="font-bold text-gray-800 tracking-wide">
                🍼 iCare 육아 상담소
              </Typography>
            </Box>
            <Typography variant="caption" className="text-gray-400">
              Room: {currentRoomId?.substring(0, 8)}...
            </Typography>
          </Box>

          <Box className="flex-1 overflow-y-auto px-2 mb-4 flex flex-col gap-4">
            {isRoomLoading ? (
              <Box className="h-full flex items-center justify-center">
                <CircularProgress />
              </Box>
            ) : !currentRoomId ? (
               <Box className="h-full flex items-center justify-center text-gray-400">
                 왼쪽 메뉴에서 [+ 새 상담 시작] 버튼을 눌러주세요!
               </Box>
            ) : messages.length === 0 ? (
              <Box className="h-full flex items-center justify-center text-gray-400">
                유리 아가에 대해 궁금한 점을 간호사 선생님께 물어보세요!
              </Box>
            ) : null}

            {messages.map((msg) => {
              const isUser = msg.role === 'USER';
              return (
                <Box key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <Box
                    // ★ 모바일에서는 너비를 85%까지 쓰고 패딩(p-3)을 줄입니다. (md: 화면부터는 75% 너비, 패딩 p-4)
                    // ★ break-words 를 넣어서 글자가 밖으로 삐져나가지 않게 꽉 잡아줍니다!
                    className={`max-w-[85%] md:max-w-[75%] p-3 md:p-4 rounded-2xl shadow-sm break-words ${
                      isUser 
                        ? 'bg-blue-600 text-white rounded-tr-sm' 
                        : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm' 
                    }`}
                  >
                    {isUser ? (
                      // ★ whitespace-pre-wrap 을 넣어 엔터키(줄바꿈)도 모바일에서 예쁘게 먹히도록 합니다.
                      <Typography variant="body1" className="break-words whitespace-pre-wrap text-sm md:text-base">
                        {msg.content}
                      </Typography>
                    ) : (
                      <Box className="prose prose-sm max-w-none break-words">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </Box>
                    )}
                  </Box>
                </Box>
              );
            })}

            {isLoading && (
              <Box className="flex justify-start">
                <Box className="max-w-[80%] p-4 rounded-2xl bg-white text-gray-800 border border-gray-200 rounded-tl-sm flex items-center gap-3 shadow-sm">
                  <CircularProgress size={20} thickness={5} /> 
                  <Typography variant="body2" className="text-gray-500 animate-pulse">
                    간호사 선생님이 답변을 작성하고 있어요...
                  </Typography>
                </Box>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {currentRoomId && (
            <Box className="mb-2">
              <QuickReplies onSelect={handleQuickReply} />
            </Box>
          )}

          {/* 하단 입력창 */}
          <Box className="flex gap-2 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
            <TextField
              fullWidth
              variant="standard"
              placeholder={currentRoomId ? "메시지를 입력하세요..." : "방을 먼저 생성해주세요!"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
              disabled={isLoading || !currentRoomId} 
              InputProps={{ disableUnderline: true, className: "px-2 py-1" }}
            />
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => handleSend()} 
              disabled={isLoading || !input.trim() || !currentRoomId} 
              className="rounded-lg px-6"
              sx={{ boxShadow: 'none' }}
            >
              <SendIcon fontSize="small" />
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}