package com.chatbot.parenting.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/upload")
@RequiredArgsConstructor
public class FileUploadController {

    @Value("${upload.dir:/app/uploads}")
    private String uploadDir;

    @PostMapping
    public ResponseEntity<?> upload(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal Object principal) {

        if (principal == null) return ResponseEntity.status(401).body("로그인이 필요합니다.");
        if (file.isEmpty()) return ResponseEntity.badRequest().body("파일이 없습니다.");

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
        String ext = originalName.contains(".")
                ? originalName.substring(originalName.lastIndexOf('.'))
                : "";
        String allowed = ".jpg.jpeg.png.gif.webp";
        if (!allowed.contains(ext.toLowerCase()))
            return ResponseEntity.badRequest().body("이미지 파일(jpg, png, gif, webp)만 업로드 가능합니다.");

        try {
            Path dir = Paths.get(uploadDir);
            Files.createDirectories(dir);
            String filename = UUID.randomUUID() + ext;
            Files.copy(file.getInputStream(), dir.resolve(filename),
                    StandardCopyOption.REPLACE_EXISTING);
            return ResponseEntity.ok(Map.of("url", "/api/upload/" + filename));
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("파일 저장에 실패했습니다.");
        }
    }

    @GetMapping("/{filename:.+}")
    public ResponseEntity<byte[]> getFile(@PathVariable String filename) {
        try {
            Path path = Paths.get(uploadDir).resolve(filename).normalize();
            if (!path.startsWith(Paths.get(uploadDir)))
                return ResponseEntity.badRequest().build();
            byte[] data = Files.readAllBytes(path);
            String contentType = determineContentType(filename);
            return ResponseEntity.ok()
                    .header("Content-Type", contentType)
                    .header("Cache-Control", "max-age=86400")
                    .body(data);
        } catch (IOException e) {
            return ResponseEntity.notFound().build();
        }
    }

    private String determineContentType(String filename) {
        String lower = filename.toLowerCase();
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".gif")) return "image/gif";
        if (lower.endsWith(".webp")) return "image/webp";
        return "image/jpeg";
    }
}
