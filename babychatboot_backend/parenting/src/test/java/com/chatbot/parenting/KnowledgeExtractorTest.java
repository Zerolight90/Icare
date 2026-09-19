package com.chatbot.parenting;

import com.chatbot.parenting.service.KnowledgeExtractor;
import com.chatbot.parenting.service.KnowledgeService;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import org.apache.pdfbox.pdmodel.*;
import org.apache.pdfbox.pdmodel.font.*;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import static org.assertj.core.api.Assertions.*;

class KnowledgeExtractorTest {
    final KnowledgeExtractor extractor = new KnowledgeExtractor();
    @Test void pdfPreservesPageTextIncludingBottomLines() throws Exception {
        var bytes = new ByteArrayOutputStream();
        try (var doc = new PDDocument()) {
            for (String text : new String[]{"First page with safety note", "Second page with revision"}) {
                var page = new PDPage(); doc.addPage(page);
                try (var content = new PDPageContentStream(doc, page)) {
                    content.beginText(); content.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                    content.newLineAtOffset(30, 30); content.showText(text); content.endText();
                }
            }
            doc.save(bytes);
        }
        var result = extractor.file(new MockMultipartFile("file", "test.pdf", "application/pdf", bytes.toByteArray()));
        assertThat(result).extracting(KnowledgeExtractor.Part::page).containsExactly(1, 2);
        assertThat(result.get(0).text()).contains("safety note");
        assertThat(result.get(1).text()).contains("revision");
    }
    @Test void docxExtractsParagraphsAndTableAndUtf8Text() throws Exception {
        var bytes = new ByteArrayOutputStream();
        try (var doc = new XWPFDocument()) {
            doc.createParagraph().createRun().setText("검증용 원문");
            doc.createTable(1,1).getRow(0).getCell(0).setText("검증용 표"); doc.write(bytes);
        }
        assertThat(extractor.file(new MockMultipartFile("file", "test.docx", "application/octet-stream", bytes.toByteArray())).get(0).text()).contains("검증용 원문", "검증용 표");
        assertThat(extractor.file(new MockMultipartFile("file", "test.md", "text/plain", "한글\r\n문서".getBytes(StandardCharsets.UTF_8))).get(0).text()).isEqualTo("한글\n문서");
    }
    @Test void rejectsBlankScannedCorruptOversizedAndUnsupportedFiles() throws Exception {
        assertThatThrownBy(() -> extractor.text("x".repeat(30001))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> extractor.file(new MockMultipartFile("file", "test.exe", "text/plain", new byte[]{1}))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> extractor.file(new MockMultipartFile("file", "test.txt", "text/plain", new byte[]{(byte)0xff}))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> extractor.file(new MockMultipartFile("file", "test.docx", "application/octet-stream", new byte[]{1,2,3}))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> extractor.file(new MockMultipartFile("file", "test.pdf", "application/pdf", new byte[2*1024*1024+1]))).isInstanceOf(IllegalArgumentException.class);
        var bytes = new ByteArrayOutputStream();
        try (var doc = new PDDocument()) { doc.addPage(new PDPage()); doc.save(bytes); }
        assertThatThrownBy(() -> extractor.file(new MockMultipartFile("file", "scan.pdf", "application/pdf", bytes.toByteArray()))).hasMessageContaining("OCR");
    }
    @Test void sourceMetadataValidatesAndKeepsUnknownRevisionExplicit() {
        assertThat(new KnowledgeService.Metadata("Test", "https://example.test/doc#page", "Publisher", "").sourceUrl()).isEqualTo("https://example.test/doc");
        assertThatThrownBy(() -> new KnowledgeService.Metadata("Test", "javascript:alert(1)", "Publisher", "")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new KnowledgeService.Metadata("Test", "https://example.test/doc", "Publisher", "2099-01-01")).isInstanceOf(IllegalArgumentException.class);
    }
}
