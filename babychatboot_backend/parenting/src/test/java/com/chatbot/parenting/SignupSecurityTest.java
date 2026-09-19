package com.chatbot.parenting;

import com.chatbot.parenting.config.AccountPolicy;
import com.chatbot.parenting.controller.UserController;
import com.chatbot.parenting.domain.User;
import com.chatbot.parenting.dto.*;
import com.chatbot.parenting.repository.*;
import com.chatbot.parenting.service.*;
import com.chatbot.parenting.util.JwtUtil;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.time.LocalDate;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SignupSecurityTest {
    private final UserRepository users = mock(UserRepository.class);
    private final FamilyRepository families = mock(FamilyRepository.class);
    private final BabyRepository babies = mock(BabyRepository.class);
    private final JwtUtil jwt = mock(JwtUtil.class);
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final AccountPolicy policy = new AccountPolicy();
    private final UserService service = new UserService(users, families, babies, encoder, jwt, mock(CommunityCache.class), policy);
    private final ObjectMapper json = new ObjectMapper().findAndRegisterModules();

    private SignupRequestDto valid() {
        var dto = new SignupRequestDto();
        dto.setEmail("signup@example.test"); dto.setPassword("Synthetic-password-123");
        dto.setRole("MOM"); dto.setName("Test"); dto.setNickname("Tester");
        dto.setBirthDate(LocalDate.of(1990, 1, 1)); dto.setPhoneNumber("010-0000-0000");
        dto.setPostalCode("04524"); dto.setAddress("Test street"); dto.setDetailAddress("Unit 1");
        dto.setBabyCount(1); dto.setBabyNames(List.of("Test baby")); dto.setBabyGenders(List.of("U"));
        dto.setBabyBirthDate(LocalDate.of(2026, 1, 1));
        return dto;
    }

    @ParameterizedTest
    @ValueSource(strings = {"postalCode", "address", "detailAddress", "name", "nickname", "phoneNumber", "birthDate", "babyNames", "babyGenders", "babyBirthDate", "password", "role"})
    void directApiRejectsMissingRequiredFieldsBeforeRepositoryAccess(String field) throws Exception {
        var payload = json.valueToTree(valid());
        ((com.fasterxml.jackson.databind.node.ObjectNode) payload).remove(field);
        var mvc = MockMvcBuilders.standaloneSetup(new UserController(service, mock(EmailService.class), users, policy)).build();
        mvc.perform(post("/api/users/signup").contentType("application/json").content(json.writeValueAsBytes(payload)))
                .andExpect(status().isBadRequest());
        verifyNoInteractions(users, families, babies);
    }

    @Test void malformedValuesCannotWriteAnyRows() {
        List<java.util.function.Consumer<SignupRequestDto>> invalid = List.of(
                d -> d.setPostalCode("1234"), d -> d.setDetailAddress("   "),
                d -> d.setAddress("\u3000"), d -> d.setDetailAddress("x".repeat(201)),
                d -> d.setAddress("x".repeat(250)), d -> d.setName(" "),
                d -> d.setPhoneNumber("nonsense"), d -> d.setBirthDate(LocalDate.now().plusDays(1)),
                d -> d.setBabyNames(List.of(" ")), d -> d.setBabyGenders(Arrays.asList((String) null)),
                d -> d.setBabyBirthDate(LocalDate.now().plusDays(1)), d -> d.setBabyCount(4),
                d -> d.setPassword("123456789"), d -> d.setInviteCode("invalid-code"));
        for (var mutation : invalid) {
            var dto = valid(); mutation.accept(dto);
            assertThatThrownBy(() -> service.signup(dto)).isInstanceOf(IllegalArgumentException.class);
        }
        verifyNoInteractions(users, families, babies);
    }

    @Test void signupHashesWithSaltAndLoginRequiresVerifiedEmailAndMatchingPassword() throws Exception {
        var dto = valid(); service.signup(dto);
        var captured = ArgumentCaptor.forClass(User.class);
        verify(users).save(captured.capture()); var user = captured.getValue();
        assertThat(user.getPassword()).startsWith("$2a$").hasSize(60).isNotEqualTo(dto.getPassword());
        assertThat(encoder.matches(dto.getPassword(), user.getPassword())).isTrue();
        assertThat(encoder.encode(dto.getPassword())).isNotEqualTo(user.getPassword());
        assertThat(user.getAddress()).isEqualTo("(04524) Test street Unit 1");
        user.setVerificationCode("123456");
        var serialized = json.valueToTree(user);
        assertThat(serialized.has("password")).isFalse();
        assertThat(serialized.has("verificationCode")).isFalse();
        when(users.findByEmailIgnoreCase(dto.getEmail())).thenReturn(Optional.of(user));
        var login = mock(LoginRequestDto.class);
        when(login.getEmail()).thenReturn(" SIGNUP@example.test ");
        when(login.getPassword()).thenReturn(dto.getPassword());
        assertThatThrownBy(() -> service.login(login)).hasMessageContaining("인증");
        assertThat(service.verifyEmail(dto.getEmail(), "000000")).isFalse();
        assertThat(service.verifyEmail(dto.getEmail(), "123456")).isTrue();
        assertThat(user.getVerificationCode()).isNull();
        when(login.getPassword()).thenReturn("wrong-password");
        assertThatThrownBy(() -> service.login(login)).hasMessageContaining("비밀번호");
        verifyNoInteractions(jwt);
        when(login.getPassword()).thenReturn(dto.getPassword());
        when(jwt.createUserToken(dto.getEmail(), "MOM")).thenReturn("synthetic-token");
        assertThat(service.login(login)).isEqualTo("synthetic-token");
    }

    @Test void passwordChangeHashesNewValueAndDisablesOldPassword() {
        var dto = valid(); service.signup(dto);
        var captured = ArgumentCaptor.forClass(User.class); verify(users).save(captured.capture());
        var user = captured.getValue(); when(users.findByEmail(dto.getEmail())).thenReturn(Optional.of(user));
        var change = mock(ChangePasswordRequestDto.class);
        when(change.getCurrentPassword()).thenReturn(dto.getPassword());
        when(change.getNewPassword()).thenReturn("New-synthetic-password");
        service.changePassword(dto.getEmail(), change);
        assertThat(encoder.matches("New-synthetic-password", user.getPassword())).isTrue();
        assertThat(encoder.matches(dto.getPassword(), user.getPassword())).isFalse();
    }

    @Test void nullOrOversizedLoginPasswordsAreRejectedBeforeLookup() {
        var login = mock(LoginRequestDto.class); when(login.getEmail()).thenReturn("signup@example.test");
        for (String password : new String[]{null, "", "가".repeat(25)}) {
            when(login.getPassword()).thenReturn(password);
            assertThatThrownBy(() -> service.login(login)).isInstanceOf(IllegalArgumentException.class);
        }
        verifyNoInteractions(users, jwt);
    }
}
