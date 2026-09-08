package com.chatbot.parenting;

import org.junit.jupiter.api.Test;
import com.chatbot.parenting.config.DataInitializer;
import com.chatbot.parenting.service.KnowledgeLoaderService;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import static org.assertj.core.api.Assertions.assertThat;

class ParentingApplicationTests {

	@Test
	void normalStartupDoesNotCreateAccountsOrLoadKnowledge() {
		new ApplicationContextRunner()
			.withUserConfiguration(DataInitializer.class, KnowledgeLoaderService.class)
			.run(context -> {
				assertThat(context).hasNotFailed();
				assertThat(context).doesNotHaveBean(DataInitializer.class);
				assertThat(context).doesNotHaveBean(KnowledgeLoaderService.class);
			});
	}

}
