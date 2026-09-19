package com.chatbot.parenting.service;

import com.chatbot.parenting.domain.*;
import com.chatbot.parenting.dto.*;
import com.chatbot.parenting.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class CommunityService {

    private final BoardRepository boardRepository;
    private final CommunityPostRepository postRepository;
    private final CommunityCommentRepository commentRepository;
    private final UserRepository userRepository;
    private final CommunityCache cache;

    @Transactional(readOnly = true)
    public List<Board> getBoards(String type) {
        if (type != null && !type.isBlank())
            return boardRepository.findByBoardTypeAndActiveOrderByDisplayOrderAsc(type, true);
        return boardRepository.findByActiveOrderByDisplayOrderAsc(true);
    }

    @Transactional(readOnly = true)
    public Page<PostListResponseDto> getPosts(Long boardId, int page, int size) {
        if (page < 0 || page > 1000 || size < 1 || size > 50) throw new IllegalArgumentException("페이지 범위를 확인해 주세요.");
        Board board = findBoard(boardId);
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return cache.posts(boardId, pageable, () -> postRepository.findByBoardAndStatusOrderByCreatedAtDesc(board, 1, pageable)
                .map(p -> new PostListResponseDto(
                        p.getId(), p.getTitle(), p.getAuthor().getNickname(),
                        p.getCommentCount(), p.getViewCount(),
                        p.getCreatedAt().toString(),
                        p.getBoard().getName(), p.getBoard().getId())));
    }

    @Transactional
    public PostDetailResponseDto getPost(Long postId) {
        CommunityPost post = findPost(postId);
        post.incrementViewCount();
        cache.invalidateAfterCommit();
        List<PostDetailResponseDto.CommentDto> commentDtos = commentRepository
                .findByPostOrderByCreatedAtAsc(post).stream()
                .map(c -> new PostDetailResponseDto.CommentDto(
                        c.getId(), c.getContent(),
                        c.getAuthor().getNickname(), c.getAuthor().getEmail(),
                        c.getCreatedAt().toString()))
                .collect(Collectors.toList());
        return toDetailDto(post, commentDtos);
    }

    @Transactional
    public PostDetailResponseDto createPost(String email, Long boardId, PostRequestDto dto) {
        validateContent(dto.getTitle(), dto.getContent());
        User user = findUser(email);
        Board board = findBoard(boardId);
        CommunityPost post = new CommunityPost(dto.getTitle(), dto.getContent(), dto.getImageUrls(), board, user);
        cache.invalidateAfterCommit();
        return toDetailDto(postRepository.save(post), List.of());
    }

    @Transactional
    public void updatePost(String email, Long postId, PostRequestDto dto) {
        validateContent(dto.getTitle(), dto.getContent());
        CommunityPost post = findPost(postId);
        checkAuthor(post.getAuthor().getEmail(), email, "수정");
        post.update(dto.getTitle(), dto.getContent(), dto.getImageUrls());
        cache.invalidateAfterCommit();
    }

    @Transactional
    public void deletePost(String email, Long postId) {
        CommunityPost post = findPost(postId);
        checkAuthor(post.getAuthor().getEmail(), email, "삭제");
        post.softDelete();
        cache.invalidateAfterCommit();
    }

    @Transactional
    public PostDetailResponseDto.CommentDto addComment(String email, Long postId, String content) {
        if (content == null || content.isBlank())
            throw new IllegalArgumentException("댓글 내용을 입력해주세요.");
        User user = findUser(email);
        CommunityPost post = findPost(postId);
        CommunityComment comment = new CommunityComment(content.trim(), post, user);
        commentRepository.save(comment);
        post.incrementCommentCount();
        cache.invalidateAfterCommit();
        return new PostDetailResponseDto.CommentDto(
                comment.getId(), comment.getContent(),
                user.getNickname(), user.getEmail(),
                comment.getCreatedAt().toString());
    }

    @Transactional
    public void deleteComment(String email, Long commentId) {
        CommunityComment comment = commentRepository.findById(commentId)
                .orElseThrow(() -> new IllegalArgumentException("댓글을 찾을 수 없습니다."));
        checkAuthor(comment.getAuthor().getEmail(), email, "삭제");
        comment.getPost().decrementCommentCount();
        commentRepository.delete(comment);
        cache.invalidateAfterCommit();
    }

    private void validateContent(String title, String content) {
        if (title == null || title.isBlank()) throw new IllegalArgumentException("제목을 입력해주세요.");
        if (content == null || content.isBlank()) throw new IllegalArgumentException("내용을 입력해주세요.");
    }

    private void checkAuthor(String authorEmail, String requestEmail, String action) {
        if (!authorEmail.equals(requestEmail))
            throw new IllegalArgumentException(action + " 권한이 없습니다.");
    }

    private Board findBoard(Long id) {
        return boardRepository.findById(id).filter(Board::isActive)
                .orElseThrow(() -> new IllegalArgumentException("게시판을 찾을 수 없습니다."));
    }

    private CommunityPost findPost(Long id) {
        CommunityPost post = postRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
        if (post.isDeleted()) throw new IllegalArgumentException("삭제된 게시글입니다.");
        return post;
    }

    private User findUser(String email) {
        return userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("사용자를 찾을 수 없습니다."));
    }

    private PostDetailResponseDto toDetailDto(CommunityPost p, List<PostDetailResponseDto.CommentDto> comments) {
        return new PostDetailResponseDto(
                p.getId(), p.getTitle(), p.getContent(), p.getImageUrls(),
                p.getAuthor().getNickname(), p.getAuthor().getEmail(),
                p.getViewCount(),
                p.getCreatedAt().toString(),
                p.getUpdatedAt().toString(),
                p.getBoard().getName(), p.getBoard().getId(),
                comments);
    }
}
