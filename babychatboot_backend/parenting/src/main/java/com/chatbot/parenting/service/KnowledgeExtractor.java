package com.chatbot.parenting.service;

import java.io.*;
import java.nio.ByteBuffer;
import java.nio.charset.*;
import java.util.*;
import java.util.zip.ZipInputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

@Component
public class KnowledgeExtractor {
    public static final int MAX_CHARS = 30000;
    public record Part(int page, String text) { }

    public List<Part> text(String text) { return checked(List.of(new Part(0, text == null ? "" : text))); }

    public List<Part> file(MultipartFile file) {
        if (file.isEmpty() || file.getSize() > 2 * 1024 * 1024) throw new IllegalArgumentException("파일은 2MB 이내여야 합니다.");
        String name = Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase(Locale.ROOT);
        try {
            byte[] bytes = file.getBytes();
            if (name.endsWith(".pdf")) {
                try (var pdf = Loader.loadPDF(bytes)) {
                    if (pdf.isEncrypted() || pdf.getNumberOfPages() > 100) throw new IllegalArgumentException("암호화되지 않은 100쪽 이내 PDF만 지원합니다.");
                    var stripper = new PDFTextStripper();
                    var parts = new ArrayList<Part>(); int length = 0;
                    for (int page = 1; page <= pdf.getNumberOfPages(); page++) {
                        stripper.setStartPage(page); stripper.setEndPage(page);
                        String value = stripper.getText(pdf); length += value.length();
                        if (length > MAX_CHARS) throw tooLong();
                        parts.add(new Part(page, value));
                    }
                    return checked(parts);
                }
            }
            if (name.endsWith(".docx")) {
                checkZip(bytes);
                try (var doc = new XWPFDocument(new ByteArrayInputStream(bytes)); var extractor = new XWPFWordExtractor(doc)) {
                    return text(extractor.getText());
                }
            }
            if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".csv")) {
                return text(StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                        .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString());
            }
            throw new IllegalArgumentException("PDF, DOCX, UTF-8 TXT/MD/CSV 파일만 지원합니다.");
        } catch (IOException e) { throw new IllegalArgumentException("파일을 읽을 수 없습니다. 형식과 암호화 여부를 확인해 주세요."); }
    }

    private void checkZip(byte[] bytes) throws IOException {
        var names = new HashSet<String>(); long total = 0; boolean document = false;
        try (var zip = new ZipInputStream(new ByteArrayInputStream(bytes))) {
            java.util.zip.ZipEntry entry; byte[] buffer = new byte[8192];
            while ((entry = zip.getNextEntry()) != null) {
                if (!names.add(entry.getName()) || names.size() > 1000) throw new IllegalArgumentException("DOCX 압축 구조가 유효하지 않습니다.");
                if (entry.getName().equals("word/document.xml")) document = true;
                int read;
                while ((read = zip.read(buffer)) != -1) { total += read; if (total > 8 * 1024 * 1024) throw new IllegalArgumentException("DOCX 압축 해제 크기가 너무 큽니다."); }
            }
        }
        if (!document) throw new IllegalArgumentException("유효한 DOCX 문서가 아닙니다.");
    }

    private List<Part> checked(List<Part> parts) {
        var result = parts.stream().map(p -> new Part(p.page(), p.text().replace("\r\n", "\n").replace('\r', '\n').strip()))
                .filter(p -> !p.text().isBlank()).toList();
        if (result.isEmpty()) throw new IllegalArgumentException("추출할 텍스트가 없습니다. 스캔 PDF는 OCR 후 검토해 주세요.");
        if (result.stream().mapToInt(p -> p.text().length()).sum() > MAX_CHARS) throw tooLong();
        if (result.stream().anyMatch(p -> p.text().indexOf('\0') >= 0)) throw new IllegalArgumentException("텍스트에 지원하지 않는 문자가 있습니다.");
        return result;
    }
    private IllegalArgumentException tooLong() { return new IllegalArgumentException("문서는 추출 후 30,000자 이내여야 합니다. 주제별로 나눠 주세요."); }
}
