package com.munify.core.security;

import com.munify.core.model.User;
import com.munify.core.repository.UserRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.UUID;

/**
 * After a successful Google OAuth2 login, this handler:
 * 1. Creates or finds the user in the local database.
 * 2. Generates a JWT token.
 * 3. Redirects to the frontend with the token as a query param.
 */
@Component
public class OAuth2LoginSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    @org.springframework.context.annotation.Lazy
    private PasswordEncoder passwordEncoder;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException, ServletException {

        OAuth2User oAuth2User = (OAuth2User) authentication.getPrincipal();

        String email = oAuth2User.getAttribute("email");
        String name = oAuth2User.getAttribute("name");
        String picture = oAuth2User.getAttribute("picture");

        if (email == null) {
            throw new ServletException("Email not provided by OAuth2 provider");
        }

        // Find or create user
        User user = userRepository.findByEmail(email).orElseGet(() -> {
            User newUser = new User();
            newUser.setUsername(name != null ? name.replaceAll("\\s+", "_").toLowerCase() : email.split("@")[0]);
            newUser.setEmail(email);
            // OAuth users don't use a password, but the field is required. Set a random one.
            newUser.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
            newUser.setRole("ROLE_USER");
            newUser.setProvider("google");
            newUser.setPictureUrl(picture);
            return userRepository.save(newUser);
        });

        // Generate JWT for the local user
        UserDetails userDetails = org.springframework.security.core.userdetails.User
                .withUsername(user.getUsername())
                .password(user.getPassword())
                .authorities("ROLE_USER")
                .build();

        String jwt = jwtUtil.generateToken(userDetails);

        // Redirect to frontend with the token
        String frontendUrl = "http://localhost:3001/auth/callback?token=" + jwt;
        getRedirectStrategy().sendRedirect(request, response, frontendUrl);
    }
}
