package com.chatbot.parenting.config;

import com.chatbot.parenting.domain.Admin;
import com.chatbot.parenting.repository.AdminRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Explicit one-time operation; never changes an existing administrator. */
@Component
@ConditionalOnProperty(name = "icare.admin.bootstrap.enabled", havingValue = "true")
public class AdminBootstrap implements ApplicationRunner {
    private final AdminRepository admins;
    private final PasswordEncoder encoder;
    private final String email;
    private final String password;

    public AdminBootstrap(AdminRepository admins, PasswordEncoder encoder, AccountPolicy access,
            @Value("${icare.admin.bootstrap.email:}") String email,
            @Value("${icare.admin.bootstrap.password:}") String password) {
        this.admins = admins;
        this.encoder = encoder;
        this.email = access.requireEmail(email);
        AccountPolicy.requirePassword(password);
        this.password = password;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (admins.count() != 0) throw new IllegalStateException("Existing administrators require a reviewed account procedure");
        admins.save(new Admin(email, encoder.encode(password), "iCare 관리자"));
    }
}
