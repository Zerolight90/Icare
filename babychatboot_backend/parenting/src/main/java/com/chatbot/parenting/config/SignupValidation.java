package com.chatbot.parenting.config;

import com.chatbot.parenting.dto.SignupRequestDto;
import java.time.LocalDate;

/** Validate the API independently of browser required fields, before any writes. */
public final class SignupValidation {
    private SignupValidation() {}

    public static String validate(SignupRequestDto dto) {
        dto.setName(required(dto.getName(), "이름", 100));
        dto.setNickname(required(dto.getNickname(), "닉네임", 100));
        String phone = required(dto.getPhoneNumber(), "전화번호", 20);
        if (!phone.matches("[0-9+() -]{9,20}") || phone.replaceAll("\\D", "").length() < 9)
            throw new IllegalArgumentException("전화번호를 확인해 주세요.");
        dto.setPhoneNumber(phone);
        if (dto.getBirthDate() == null || dto.getBirthDate().isAfter(LocalDate.now()))
            throw new IllegalArgumentException("생년월일을 확인해 주세요.");
        String postalCode = required(dto.getPostalCode(), "우편번호", 5);
        if (!postalCode.matches("[0-9]{5}")) throw new IllegalArgumentException("우편번호는 5자리 숫자여야 합니다.");
        String address = required(dto.getAddress(), "기본주소", 255);
        String detail = required(dto.getDetailAddress(), "상세주소", 200);
        String fullAddress = "(" + postalCode + ") " + address + " " + detail;
        if (fullAddress.length() > 255) throw new IllegalArgumentException("주소는 우편번호와 상세주소를 포함해 255자 이내여야 합니다.");
        String invite = dto.getInviteCode() == null ? "" : dto.getInviteCode().strip().toUpperCase(java.util.Locale.ROOT);
        if (!invite.isEmpty() && !invite.matches("[A-Z0-9]{6}"))
            throw new IllegalArgumentException("초대 코드는 영문과 숫자 6자리여야 합니다.");
        dto.setInviteCode(invite);
        if (invite.isEmpty()) {
            int count = dto.getBabyCount();
            if (count < 1 || count > 3 || dto.getBabyNames() == null || dto.getBabyGenders() == null
                    || dto.getBabyNames().size() != count || dto.getBabyGenders().size() != count
                    || dto.getBabyBirthDate() == null || dto.getBabyBirthDate().isAfter(LocalDate.now()))
                throw new IllegalArgumentException("아기 정보를 확인해 주세요.");
            dto.setBabyNames(dto.getBabyNames().stream().map(name -> required(name, "아기 이름", 100)).toList());
            for (String gender : dto.getBabyGenders()) {
                if (!"M".equals(gender) && !"F".equals(gender) && !"U".equals(gender))
                    throw new IllegalArgumentException("아기 성별을 확인해 주세요.");
            }
        }
        return fullAddress;
    }

    private static String required(String value, String label, int max) {
        if (value == null || value.isBlank() || value.strip().length() > max)
            throw new IllegalArgumentException(label + "을(를) 1~" + max + "자로 입력해 주세요.");
        return value.strip();
    }
}
