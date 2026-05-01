package com.chatbot.parenting.service;

import lombok.RequiredArgsConstructor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

import java.util.Random;

@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender; // 스프링이 제공하는 메일 배달부

    // 1. 6자리 랜덤 인증번호 생성기
    public String generateVerificationCode() {
        Random random = new Random();
        int code = 100000 + random.nextInt(900000); // 100000 ~ 999999 범위의 난수
        return String.valueOf(code);
    }

    // 2. 이메일 전송 메서드
    public void sendVerificationEmail(String toEmail, String code) {
        SimpleMailMessage message = new SimpleMailMessage();
        
        message.setTo(toEmail); // 받는 사람
        message.setSubject("[iCare] 회원가입 이메일 인증 번호입니다."); // 메일 제목
        message.setText("안녕하세요! iCare 육아 플랫폼입니다.\n\n" +
                        "회원가입을 위한 인증 번호는 다음과 같습니다.\n\n" +
                        "인증 번호: [" + code + "]\n\n" +
                        "해당 번호를 화면에 입력해 주세요."); // 메일 내용

        mailSender.send(message); // 발송 슛!
    }
}