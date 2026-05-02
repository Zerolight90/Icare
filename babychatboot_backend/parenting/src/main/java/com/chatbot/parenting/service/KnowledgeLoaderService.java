package com.chatbot.parenting.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.document.Document;
import org.springframework.ai.reader.ExtractedTextFormatter;
import org.springframework.ai.reader.TextReader;
import org.springframework.ai.reader.pdf.PagePdfDocumentReader;
import org.springframework.ai.reader.pdf.config.PdfDocumentReaderConfig;
import org.springframework.ai.reader.tika.TikaDocumentReader;
import org.springframework.ai.transformer.splitter.TokenTextSplitter;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class KnowledgeLoaderService implements ApplicationRunner {

    private final VectorStore vectorStore;

    private static final TokenTextSplitter SPLITTER = new TokenTextSplitter(
        512,   // 청크 최대 토큰 수
        64,    // 최소 청크 길이(char)
        5,     // 합칠 문장 수
        10000, // 최대 청크 수
        true,
        List.of('.', ',', '!', '?', ';', ':')
    );

    @Override
    public void run(ApplicationArguments args) {
        List<Document> existing = vectorStore.similaritySearch(
            SearchRequest.builder().query("수유").topK(1).build()
        );
        if (!existing.isEmpty()) {
            log.info("[RAG] 벡터스토어에 문서가 이미 존재합니다. 로딩을 건너뜁니다.");
            return;
        }

        log.info("[RAG] documents/ 폴더의 문서를 벡터스토어에 로딩합니다...");

        List<Document> allDocs = new ArrayList<>();
        allDocs.addAll(loadTextFiles());
        allDocs.addAll(loadPdfFiles());
        allDocs.addAll(loadTikaFiles());

        if (allDocs.isEmpty()) {
            log.warn("[RAG] 로딩할 문서가 없습니다. src/main/resources/documents/ 폴더를 확인하세요.");
            return;
        }

        List<Document> chunks = SPLITTER.apply(allDocs);
        vectorStore.add(chunks);

        log.info("[RAG] 총 {}개 청크를 벡터스토어에 저장 완료.", chunks.size());
    }

    // .txt 파일
    private List<Document> loadTextFiles() {
        return loadByPattern("classpath:documents/*.txt", path -> {
            var resource = resolveResource(path);
            return new TextReader(resource).get();
        });
    }

    // .pdf 파일 (페이지 단위 추출, 텍스트 레이어만)
    private List<Document> loadPdfFiles() {
        var config = PdfDocumentReaderConfig.builder()
            .withPageExtractedTextFormatter(ExtractedTextFormatter.builder()
                .withNumberOfBottomTextLinesToDelete(3)  // 페이지 번호 등 하단 제거
                .withNumberOfTopPagesToSkipBeforeDelete(1)
                .build())
            .withPagesPerDocument(1)
            .build();

        return loadByPattern("classpath:documents/*.pdf", path -> {
            var resource = resolveResource(path);
            return new PagePdfDocumentReader(resource, config).get();
        });
    }

    // .docx / .doc / .pptx / .xlsx 등 (Apache Tika)
    private List<Document> loadTikaFiles() {
        return loadByPattern("classpath:documents/*.{docx,doc,pptx,ppt,xlsx,xls}", path -> {
            var resource = resolveResource(path);
            return new TikaDocumentReader(resource).get();
        });
    }

    // 패턴에 일치하는 리소스를 찾아 문서 목록으로 수집
    private List<Document> loadByPattern(String pattern, DocumentLoader loader) {
        List<Document> result = new ArrayList<>();
        try {
            var resolver = new PathMatchingResourcePatternResolver();
            Resource[] resources = resolver.getResources(pattern);
            for (Resource resource : resources) {
                try {
                    List<Document> docs = loader.load(resource.getURI().toString());
                    result.addAll(docs);
                    log.info("[RAG] 로딩 완료: {} → {}개 문서", resource.getFilename(), docs.size());
                } catch (Exception e) {
                    log.warn("[RAG] 파일 읽기 실패: {} ({})", resource.getFilename(), e.getMessage());
                }
            }
        } catch (Exception e) {
            log.debug("[RAG] 패턴 검색 결과 없음: {}", pattern);
        }
        return result;
    }

    private Resource resolveResource(String path) {
        return new PathMatchingResourcePatternResolver().getResource(path);
    }

    @FunctionalInterface
    interface DocumentLoader {
        List<Document> load(String path) throws Exception;
    }
}
