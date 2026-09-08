package com.chatbot.parenting.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Hibernate cannot validate the Spring AI table. Fail before serving a mismatched profile. */
@Component
@DependsOnDatabaseInitialization
public class VectorSchemaValidator implements InitializingBean {
    private final JdbcTemplate jdbc;
    private final int dimensions;
    private final String schema;
    private final String table;

    public VectorSchemaValidator(JdbcTemplate jdbc,
            @Value("${spring.ai.vectorstore.pgvector.dimensions}") int dimensions,
            @Value("${spring.ai.vectorstore.pgvector.schema-name:public}") String schema,
            @Value("${spring.ai.vectorstore.pgvector.table-name:vector_store}") String table) {
        this.jdbc = jdbc;
        this.dimensions = dimensions;
        this.schema = schema;
        this.table = table;
    }

    @Override
    public void afterPropertiesSet() {
        var actual = jdbc.queryForList("""
            SELECT a.atttypmod FROM pg_attribute a
            JOIN pg_class c ON c.oid = a.attrelid
            JOIN pg_namespace n ON n.oid = c.relnamespace
            JOIN pg_type t ON t.oid = a.atttypid
            WHERE n.nspname = ? AND c.relname = ? AND a.attname = 'embedding'
              AND t.typname = 'vector' AND NOT a.attisdropped
            """, Integer.class, schema, table);
        if (dimensions <= 0 || actual.size() != 1 || actual.get(0) != dimensions) {
            throw new IllegalStateException("Vector schema dimensions do not match configuration; "
                    + "check the database and embedding profile before starting. No data was changed.");
        }
    }
}
