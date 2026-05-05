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

    @Transactional(readOnly = true)
    public List<Board> getBoards(String type) {
        if (type != null && !type.isBlank())
            return boardRepository.findByBoardTypeAndActiveOrderByDisplayOrderAsc(type, true);
        return boardRepository.findByActiveOrderByDisplayOrderAsc(true);
    }

    @Transactional(readOnly = true)
    public Page<PostListResponseDto> getPosts(Long boardId, int page, int size) {
        Board board = findBoard(boardId);
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return postRepository.findByBoardOrderByCreatedAtDesc(board, pageable)
                .map(p -> new PostListResponseDto(
                        p.getId(), p.getTitle(), p.getAuthor().getNickname(),
                        p.getCommentCount(), p.getViewCount(),
                        p.getCreatedAt().toString(),
                        p.getBoard().getName(), p.getBoard().getId()));
    }

    @Transactional
    public PostDetailResponseDto getPost(Long postId) {
        CommunityPost post = findPost(postId);
        post.incrementViewCount();
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
        return toDetailDto(postRepository.save(post), List.of());
    }

    @Transactional
    public void updatePost(String email, Long postId, PostRequestDto dto) {
        validateContent(dto.getTitle(), dto.getContent());
        CommunityPost post = findPost(postId);
        checkAuthor(post.getAuthor().getEmail(), email, "수정");
        post.update(dto.getTitle(), dto.getContent(), dto.getImageUrls());
    }

    @Transactional
    public void deletePost(String email, Long postId) {
        CommunityPost post = findPost(postId);
        checkAuthor(post.getAuthor().getEmail(), email, "삭제");
        commentRepository.findByPostOrderByCreatedAtAsc(post).forEach(commentRepository::delete);
        postRepository.delete(post);
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
        return boardRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("게시판을 찾을 수 없습니다."));
    }

    private CommunityPost findPost(Long id) {
        return postRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("게시글을 찾을 수 없습니다."));
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
