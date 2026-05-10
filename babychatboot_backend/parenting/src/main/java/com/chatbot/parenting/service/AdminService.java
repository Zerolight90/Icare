package com.chatbot.parenting.service;

import com.chatbot.parenting.domain.*;
import com.chatbot.parenting.repository.*;
import com.chatbot.parenting.util.JwtUtil;
import org.springframework.web.multipart.MultipartFile;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class AdminService {

    private final AdminRepository adminRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CommunityPostRepository communityPostRepository;
    private final CommunityCommentRepository communityCommentRepository;
    private final BoardRepository boardRepository;
    private final NoticeRepository noticeRepository;
    private final ChatbotConfigRepository chatbotConfigRepository;
    private final DailyLogRepository dailyLogRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final VectorStore vectorStore;
    private final JwtUtil jwtUtil;

    // ==========================================
    // 관리자 인증
    // ==========================================

    @Transactional
    public String login(String username, String password) {
        Admin admin = adminRepository.findByUsername(username)
                .orElseThrow(() -> new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다."));
        if (!admin.isActive()) {
            throw new IllegalArgumentException("비활성화된 관리자 계정입니다.");
        }
        if (!passwordEncoder.matches(password, admin.getPassword())) {
            throw new IllegalArgumentException("아이디 또는 비밀번호가 올바르지 않습니다.");
        }
        admin.recordLogin();
        return jwtUtil.createToken(admin.getUsername(), "ADMIN");
    }

    // ==========================================
    // 관리자 계정 관리
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllAdmins() {
        return adminRepository.findAll().stream().map(a -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", a.getId());
            m.put("username", a.getUsername());
            m.put("name", a.getName());
            m.put("active", a.isActive());
            m.put("createdAt", a.getCreatedAt());
            m.put("lastLoginAt", a.getLastLoginAt());
            return m;
        }).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> createAdminAccount(String username, String password, String name) {
        if (adminRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("이미 사용 중인 아이디입니다: " + username);
        }
        Admin admin = new Admin(username, passwordEncoder.encode(password), name);
        Admin saved = adminRepository.save(admin);
        Map<String, Object> result = new HashMap<>();
        result.put("id", saved.getId());
        result.put("username", saved.getUsername());
        result.put("name", saved.getName());
        return result;
    }

    @Transactional
    public void setAdminActive(Long adminId, boolean active) {
        Admin admin = adminRepository.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("관리자를 찾을 수 없습니다."));
        admin.setActive(active);
    }

    @Transactional
    public void deleteAdmin(Long adminId) {
        adminRepository.deleteById(adminId);
    }

    // ==========================================
    // 대시보드 통계
    // ==========================================

    @Transactional(readOnly = true)
    public Map<String, Object> getDashboardStats() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("totalUsers", userRepository.count());
        stats.put("totalPosts", communityPostRepository.count());
        stats.put("totalComments", communityCommentRepository.count());
        stats.put("totalBoards", boardRepository.count());
        stats.put("totalDailyLogs", dailyLogRepository.count());
        stats.put("totalChatRooms", chatRoomRepository.count());
        stats.put("totalMessages", chatMessageRepository.count());
        stats.put("totalNotices", noticeRepository.count());
        stats.put("totalAdmins", adminRepository.count());
        return stats;
    }

    // ==========================================
    // 회원 관리 (일반 사용자)
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllUsers() {
        return userRepository.findAll().stream().map(u -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", u.getId());
            m.put("email", u.getEmail());
            m.put("name", u.getName());
            m.put("nickname", u.getNickname());
            m.put("role", u.getRole());
            m.put("provider", u.getProvider());
            m.put("emailVerified", u.isEmailVerified());
            return m;
        }).collect(Collectors.toList());
    }

    @Transactional
    public void deleteUser(Long userId) {
        userRepository.deleteById(userId);
    }

    // ==========================================
    // 게시물 관리
    // ==========================================

    @Transactional(readOnly = true)
    public Page<Map<String, Object>> getAllPosts(Pageable pageable) {
        return communityPostRepository.findAllByOrderByCreatedAtDesc(pageable).map(p -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", p.getId());
            m.put("title", p.getTitle());
            m.put("authorNickname", p.getAuthor().getNickname());
            m.put("boardName", p.getBoard().getName());
            m.put("viewCount", p.getViewCount());
            m.put("commentCount", p.getCommentCount());
            m.put("status", p.getStatus());
            m.put("createdAt", p.getCreatedAt());
            return m;
        });
    }

    @Transactional
    public void deletePost(Long postId) {
        CommunityPost post = communityPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        post.softDelete();
    }

    @Transactional
    public void restorePost(Long postId) {
        CommunityPost post = communityPostRepository.findById(postId)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        post.restore();
    }

    // ==========================================
    // 게시판 관리
    // ==========================================

    @Transactional(readOnly = true)
    public List<Board> getAllBoards() {
        return boardRepository.findAll();
    }

    @Transactional
    public Board createBoard(String name, String description, Integer displayOrder, String boardType) {
        Board board = new Board(name, description, displayOrder, boardType);
        return boardRepository.save(board);
    }

    @Transactional
    public Board updateBoard(Long boardId, String name, String description, Integer displayOrder, String boardType) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("게시판을 찾을 수 없습니다."));
        board.updateAll(name, description, displayOrder, boardType);
        return board;
    }

    @Transactional
    public void setBoardActive(Long boardId, boolean active) {
        Board board = boardRepository.findById(boardId)
                .orElseThrow(() -> new IllegalArgumentException("게시판을 찾을 수 없습니다."));
        board.setActive(active);
    }

    @Transactional
    public void deleteBoard(Long boardId) {
        boardRepository.deleteById(boardId);
    }

    // ==========================================
    // 공지사항 관리
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllNotices() {
        return noticeRepository.findAllByOrderByPinnedDescCreatedAtDesc().stream().map(n -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", n.getId());
            m.put("title", n.getTitle());
            m.put("content", n.getContent());
            m.put("pinned", n.isPinned());
            m.put("active", n.isActive());
            m.put("createdAt", n.getCreatedAt());
            m.put("updatedAt", n.getUpdatedAt());
            if (n.getAuthor() != null) m.put("authorName", n.getAuthor().getName());
            return m;
        }).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getActiveNotices() {
        return noticeRepository.findByActiveTrueOrderByPinnedDescCreatedAtDesc().stream().map(n -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", n.getId());
            m.put("title", n.getTitle());
            m.put("content", n.getContent());
            m.put("pinned", n.isPinned());
            m.put("createdAt", n.getCreatedAt());
            return m;
        }).collect(Collectors.toList());
    }

    @Transactional
    public Map<String, Object> createNotice(String title, String content, boolean pinned, String adminUsername) {
        Admin admin = adminRepository.findByUsername(adminUsername)
                .orElseThrow(() -> new IllegalArgumentException("관리자를 찾을 수 없습니다."));
        Notice notice = noticeRepository.save(new Notice(title, content, pinned, admin));
        Map<String, Object> m = new HashMap<>();
        m.put("id", notice.getId());
        m.put("title", notice.getTitle());
        m.put("pinned", notice.isPinned());
        return m;
    }

    @Transactional
    public void updateNotice(Long noticeId, String title, String content, boolean pinned) {
        Notice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new IllegalArgumentException("공지사항을 찾을 수 없습니다."));
        notice.update(title, content, pinned);
    }

    @Transactional
    public void deleteNotice(Long noticeId) {
        noticeRepository.deleteById(noticeId);
    }

    @Transactional
    public void setNoticeActive(Long noticeId, boolean active) {
        Notice notice = noticeRepository.findById(noticeId)
                .orElseThrow(() -> new IllegalArgumentException("공지사항을 찾을 수 없습니다."));
        notice.setActive(active);
    }

    // ==========================================
    // 챗봇 설정 관리
    // ==========================================

    @Transactional(readOnly = true)
    public List<Map<String, Object>> getAllChatbotConfigs() {
        return chatbotConfigRepository.findAll().stream().map(c -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", c.getId());
            m.put("configKey", c.getConfigKey());
            m.put("configValue", c.getConfigValue());
            m.put("description", c.getDescription());
            m.put("updatedAt", c.getUpdatedAt());
            return m;
        }).collect(Collectors.toList());
    }

    @Transactional
    public void updateChatbotConfig(String key, String value) {
        chatbotConfigRepository.findByConfigKey(key).ifPresentOrElse(
            config -> config.update(value),
            () -> chatbotConfigRepository.save(new ChatbotConfig(key, value, ""))
        );
    }

    // ==========================================
    // 문서/임베딩 관리
    // ==========================================

    @Transactional
    public void addKnowledge(String content, String source) {
        Document doc = new Document(content, Map.of("source", source));
        List<Document> chunks = buildSplitter().apply(List.of(doc));
        vectorStore.add(chunks);
        log.info("[Admin RAG] 지식 추가: {} → {}개 청크", source, chunks.size());
    }

    @Transactional
    public Map<String, Object> uploadKnowledgeFile(MultipartFile file, String source) {
        try {
            String fileName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
            String src = (source != null && !source.isBlank()) ? source : fileName;
            String content = new String(file.getBytes(), java.nio.charset.StandardCharsets.UTF_8);
            if (content.isBlank()) throw new IllegalArgumentException("파일 내용이 비어 있습니다.");
            Document doc = new Document(content, Map.of("source", src));
            List<Document> chunks = buildSplitter().apply(List.of(doc));
            vectorStore.add(chunks);
            log.info("[Admin RAG] 파일 업로드: {} → {}개 청크", src, chunks.size());
            return Map.of("message", "파일이 임베딩되었습니다.", "source", src, "chunks", chunks.size());
        } catch (java.io.IOException e) {
            throw new RuntimeException("파일 읽기 실패: " + e.getMessage());
        }
    }

    private TokenTextSplitter buildSplitter() {
        int chunkSize = getConfigInt("rag_chunk_size", 512);
        int overlap = getConfigInt("rag_chunk_overlap", 64);
        return new TokenTextSplitter(chunkSize, overlap, 5, 10000, true,
                List.of('.', ',', '!', '?', ';', ':'));
    }

    private int getConfigInt(String key, int defaultValue) {
        return chatbotConfigRepository.findByConfigKey(key)
                .map(c -> {
                    try { return Integer.parseInt(c.getConfigValue()); }
                    catch (NumberFormatException e) { return defaultValue; }
                })
                .orElse(defaultValue);
    }

    // ==========================================
    // 일지 관리
    // ==========================================

    @Transactional(readOnly = true)
    public Page<Map<String, Object>> getAllDailyLogs(String search, Pageable pageable) {
        Page<DailyLog> logs = (search != null && !search.isBlank())
                ? dailyLogRepository.searchByKeyword(search.trim(), pageable)
                : dailyLogRepository.findAllByOrderByCreatedAtDesc(pageable);
        return logs.map(l -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", l.getId());
            m.put("babyName", l.getBaby().getName());
            m.put("userName", l.getUser().getNickname());
            m.put("recordTime", l.getRecordTime());
            m.put("formulaAmount", l.getFormulaAmount());
            m.put("breastfed", l.getBreastfed());
            m.put("diaperType", l.getDiaperType());
            m.put("memo", l.getMemo());
            m.put("createdAt", l.getCreatedAt());
            return m;
        });
    }

    @Transactional
    public void deleteDailyLog(Long logId) {
        dailyLogRepository.deleteById(logId);
    }
}
