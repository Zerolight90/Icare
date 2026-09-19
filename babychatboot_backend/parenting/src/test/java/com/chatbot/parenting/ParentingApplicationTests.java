package com.chatbot.parenting;

import org.junit.jupiter.api.Test;
import com.chatbot.parenting.config.DataInitializer;
import com.chatbot.parenting.service.KnowledgeLoaderService;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static org.assertj.core.api.Assertions.assertThat;

class ParentingApplicationTests {

    @Test void privateProfileUsesExternalSettingsWithoutLegacySecretProfile() {
        new ApplicationContextRunner()
            .withInitializer(new org.springframework.boot.test.context.ConfigDataApplicationContextInitializer())
            .withPropertyValues("spring.profiles.active=private", "GEMINI_API_KEY=synthetic-key",
                "JWT_SECRET=synthetic-jwt-secret-at-least-32-characters", "ICARE_DB_URL=jdbc:postgresql://localhost/test",
                "ICARE_DB_USER=test", "ICARE_DB_PASSWORD=test", "GEMINI_CHAT_MODEL=gemini-test",
                "ICARE_UPLOAD_DIR=test-uploads", "ICARE_CORS_ALLOWED_ORIGINS=https://frontend.example.test")
            .run(context -> {
                assertThat(context).hasNotFailed();
                var env = context.getEnvironment();
                assertThat(env.getActiveProfiles()).contains("private").doesNotContain("secret", "dev");
                assertThat(env.getProperty("spring.ai.google.genai.api-key")).isEqualTo("synthetic-key");
                assertThat(env.getProperty("spring.ai.google.genai.chat.options.model")).isEqualTo("gemini-test");
                assertThat(env.getProperty("jwt.secret")).isEqualTo("synthetic-jwt-secret-at-least-32-characters");
                assertThat(env.getProperty("spring.datasource.url")).isEqualTo("jdbc:postgresql://localhost/test");
                assertThat(env.getProperty("upload.dir")).isEqualTo("test-uploads");
                assertThat(env.getProperty("icare.security.cors-allowed-origins")).isEqualTo("https://frontend.example.test");
            });
    }

	@Test
	void normalStartupDoesNotCreateAccountsOrLoadKnowledge() {
		new ApplicationContextRunner()
			.withUserConfiguration(DataInitializer.class, KnowledgeLoaderService.class, com.chatbot.parenting.config.AdminBootstrap.class)
			.run(context -> {
				assertThat(context).hasNotFailed();
				assertThat(context).doesNotHaveBean(DataInitializer.class);
				assertThat(context).doesNotHaveBean(KnowledgeLoaderService.class);
				assertThat(context).doesNotHaveBean(com.chatbot.parenting.config.AdminBootstrap.class);
			});
	}

}
