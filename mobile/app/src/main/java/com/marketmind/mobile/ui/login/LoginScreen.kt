package com.marketmind.mobile.ui.login

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Fingerprint
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.marketmind.mobile.R
import kotlinx.coroutines.delay

private val BrandBlue = Color(0xFF4D4AF0)
private val TextDark = Color(0xFF20213A)
private val TextMuted = Color(0xFF74778D)
private val PanelBorder = Color(0xFFE0E2EE)
private val FieldBorder = Color(0xFFD6D9E6)
private val PageTop = Color(0xFFF6F2FF)
private val PageBottom = Color(0xFFFFFBFF)

@Composable
fun LoginScreen(
    onLoginSuccess: (String) -> Unit,
    viewModel: LoginViewModel = hiltViewModel(),
) {
    val keyboard = LocalSoftwareKeyboardController.current
    val state by viewModel.state.collectAsStateWithLifecycle()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var nombre by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }
    var mode by remember { mutableStateOf(AuthMode.Login) }
    var selectedRole by remember { mutableStateOf("marketero") }
    val isLoading = state is LoginUiState.Loading

    LaunchedEffect(state) {
        val success = state as? LoginUiState.Success
        if (success != null) {
            delay(1450)
            onLoginSuccess(success.role)
        }
    }

    Scaffold(containerColor = PageBottom) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Brush.verticalGradient(listOf(PageTop, PageBottom)))
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .imePadding()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 18.dp)
                    .padding(top = 42.dp, bottom = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                AppLogo()

                Spacer(modifier = Modifier.height(18.dp))

                Text(
                    text = "NexoMark IA",
                    color = BrandBlue,
                    fontSize = 25.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = 0.sp,
                )
                Text(
                    text = "Impulsa tu crecimiento con inteligencia.",
                    color = Color(0xFF40435A),
                    fontSize = 14.sp,
                    lineHeight = 18.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 9.dp),
                )

                LoginCard(
                    mode = mode,
                    onModeChange = { mode = it },
                    nombre = nombre,
                    onNombreChange = { nombre = it },
                    email = email,
                    onEmailChange = { email = it },
                    password = password,
                    onPasswordChange = { password = it },
                    passwordVisible = passwordVisible,
                    onPasswordVisibilityChange = { passwordVisible = it },
                    confirmPassword = confirmPassword,
                    onConfirmPasswordChange = { confirmPassword = it },
                    confirmPasswordVisible = confirmPasswordVisible,
                    onConfirmPasswordVisibilityChange = { confirmPasswordVisible = it },
                    selectedRole = selectedRole,
                    onRoleChange = { selectedRole = it },
                    onLogin = {
                        keyboard?.hide()
                        viewModel.login(email, password)
                    },
                    onRegister = {
                        keyboard?.hide()
                        viewModel.register(nombre, email, password, confirmPassword, selectedRole)
                    },
                    loading = isLoading,
                    errorMessage = (state as? LoginUiState.Error)?.message,
                    modifier = Modifier.padding(top = 32.dp),
                )

                Spacer(modifier = Modifier.height(34.dp))

                Text(
                    text = "SEGURIDAD IA GARANTIZADA",
                    color = TextMuted,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 2.sp,
                    textAlign = TextAlign.Center,
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(18.dp),
                    modifier = Modifier.padding(top = 17.dp),
                ) {
                    SecurityBadge(Icons.Filled.Shield)
                    SecurityBadge(Icons.Filled.VerifiedUser)
                    SecurityBadge(Icons.Filled.Fingerprint)
                }

                Spacer(modifier = Modifier.height(28.dp))

                Text(
                    text = "© 2026 NexoMark IA",
                    color = TextDark,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    textAlign = TextAlign.Center,
                )
            }

            WelcomeOverlay(
                visible = state is LoginUiState.Success,
                nombre = (state as? LoginUiState.Success)?.nombre.orEmpty(),
            )
        }
    }
}

/** Icono aprobado de NexoMark (brand/nexomark-icon-approved-1024.png), sin redibujar. */
@Composable
private fun AppLogo() {
    Image(
        painter = painterResource(R.drawable.nexomark_logo),
        contentDescription = null,
        modifier = Modifier.size(64.dp),
    )
}

@Composable
private fun LoginCard(
    mode: AuthMode,
    onModeChange: (AuthMode) -> Unit,
    nombre: String,
    onNombreChange: (String) -> Unit,
    email: String,
    onEmailChange: (String) -> Unit,
    password: String,
    onPasswordChange: (String) -> Unit,
    passwordVisible: Boolean,
    onPasswordVisibilityChange: (Boolean) -> Unit,
    confirmPassword: String,
    onConfirmPasswordChange: (String) -> Unit,
    confirmPasswordVisible: Boolean,
    onConfirmPasswordVisibilityChange: (Boolean) -> Unit,
    selectedRole: String,
    onRoleChange: (String) -> Unit,
    onLogin: () -> Unit,
    onRegister: () -> Unit,
    loading: Boolean,
    errorMessage: String?,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp),
        border = BorderStroke(1.dp, PanelBorder),
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            AuthTabs(mode = mode, onModeChange = onModeChange)

            if (mode == AuthMode.Register) {
                FieldLabel("Nombre")
                StyledTextField(
                    value = nombre,
                    onValueChange = onNombreChange,
                    placeholder = "Nombre del marketero",
                    leadingIcon = Icons.Filled.Person,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Text,
                        imeAction = ImeAction.Next,
                    ),
                )
            }

            FieldLabel("Correo Electronico")
            StyledTextField(
                value = email,
                onValueChange = onEmailChange,
                placeholder = "tu@email.com",
                leadingIcon = Icons.Filled.Email,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Email,
                    imeAction = ImeAction.Next,
                ),
            )

            FieldLabel("Contraseña")
            StyledTextField(
                value = password,
                onValueChange = onPasswordChange,
                placeholder = "••••••••",
                leadingIcon = Icons.Filled.Lock,
                trailingIcon = if (passwordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                onTrailingIconClick = { onPasswordVisibilityChange(!passwordVisible) },
                visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done,
                ),
                keyboardActions = KeyboardActions(onDone = { onLogin() }),
            )

            if (mode == AuthMode.Register) {
                FieldLabel("Confirmar contraseña")
                StyledTextField(
                    value = confirmPassword,
                    onValueChange = onConfirmPasswordChange,
                    placeholder = "••••••••",
                    leadingIcon = Icons.Filled.Lock,
                    trailingIcon = if (confirmPasswordVisible) Icons.Filled.VisibilityOff else Icons.Filled.Visibility,
                    onTrailingIconClick = { onConfirmPasswordVisibilityChange(!confirmPasswordVisible) },
                    visualTransformation = if (confirmPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(onDone = { onRegister() }),
                )
                RoleSelector(
                    selectedRole = selectedRole,
                    onRoleChange = onRoleChange,
                )
            }

            errorMessage?.let {
                Text(
                    text = it,
                    color = Color(0xFFD73737),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    lineHeight = 16.sp,
                )
            }

            Button(
                onClick = if (mode == AuthMode.Login) onLogin else onRegister,
                enabled = !loading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(58.dp)
                    .padding(top = 4.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandBlue),
                shape = RoundedCornerShape(14.dp),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 4.dp),
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        color = Color.White,
                        strokeWidth = 2.dp,
                        modifier = Modifier.size(20.dp),
                    )
                } else {
                    Text(
                        text = if (mode == AuthMode.Login) "Iniciar Sesion" else "Crear cuenta",
                        color = Color.White,
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 16.sp,
                    )
                    Icon(
                        imageVector = Icons.Filled.ArrowForward,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier
                            .padding(start = 8.dp)
                            .size(18.dp),
                    )
                }
            }

            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(Color(0xFFE9EAF3)),
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(
                    text = if (mode == AuthMode.Login) "¿No tienes una cuenta? " else "¿Ya tienes una cuenta? ",
                    color = Color(0xFF7B7E91),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    text = if (mode == AuthMode.Login) "Registrate ahora" else "Ingresa",
                    color = BrandBlue,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.clickable {
                        onModeChange(if (mode == AuthMode.Login) AuthMode.Register else AuthMode.Login)
                    },
                )
            }
        }
    }
}

@Composable
private fun AuthTabs(
    mode: AuthMode,
    onModeChange: (AuthMode) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .height(44.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0xFFF0F1F8))
            .padding(4.dp),
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        AuthTab(
            text = "Ingresar",
            selected = mode == AuthMode.Login,
            onClick = { onModeChange(AuthMode.Login) },
            modifier = Modifier.weight(1f),
        )
        AuthTab(
            text = "Crear cuenta",
            selected = mode == AuthMode.Register,
            onClick = { onModeChange(AuthMode.Register) },
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun RoleSelector(
    selectedRole: String,
    onRoleChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        FieldLabel("Tipo de cuenta")
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            RoleOption(
                label = "Marketero",
                selected = selectedRole == "marketero",
                onClick = { onRoleChange("marketero") },
                modifier = Modifier.weight(1f),
            )
            RoleOption(
                label = "Cliente",
                selected = selectedRole == "cliente",
                onClick = { onRoleChange("cliente") },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun RoleOption(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        onClick = onClick,
        modifier = modifier.height(48.dp),
        shape = RoundedCornerShape(12.dp),
        color = if (selected) BrandBlue.copy(alpha = 0.1f) else Color.White,
        border = BorderStroke(1.dp, if (selected) BrandBlue else FieldBorder),
    ) {
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(
                checked = selected,
                onCheckedChange = { onClick() },
                colors = CheckboxDefaults.colors(
                    checkedColor = BrandBlue,
                    uncheckedColor = TextMuted,
                ),
            )
            Text(
                text = label,
                color = if (selected) BrandBlue else TextDark,
                fontSize = 13.sp,
                fontWeight = FontWeight.ExtraBold,
                maxLines = 1,
            )
        }
    }
}

@Composable
private fun AuthTab(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Box(
        modifier = modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(9.dp))
            .background(if (selected) Color.White else Color.Transparent)
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = text,
            color = if (selected) BrandBlue else TextMuted,
            fontSize = 13.sp,
            fontWeight = FontWeight.ExtraBold,
            maxLines = 1,
        )
    }
}

@Composable
private fun WelcomeOverlay(
    visible: Boolean,
    nombre: String,
) {
    val scale = remember { Animatable(0.88f) }
    LaunchedEffect(visible) {
        if (visible) {
            scale.snapTo(0.88f)
            scale.animateTo(1f, tween(durationMillis = 520))
        }
    }
    AnimatedVisibility(
        visible = visible,
        enter = fadeIn(tween(220)) + slideInVertically(
            animationSpec = tween(420),
            initialOffsetY = { it / 5 },
        ),
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(Color.White.copy(alpha = 0.94f))
                .padding(24.dp),
            contentAlignment = Alignment.Center,
        ) {
            Column(
                modifier = Modifier.scale(scale.value),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Surface(
                    modifier = Modifier.size(82.dp),
                    shape = CircleShape,
                    color = BrandBlue,
                    shadowElevation = 12.dp,
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(
                            imageVector = Icons.Filled.VerifiedUser,
                            contentDescription = null,
                            tint = Color.White,
                            modifier = Modifier.size(38.dp),
                        )
                    }
                }
                Text(
                    text = "Bienvenido",
                    color = TextDark,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    modifier = Modifier.padding(top = 22.dp),
                )
                Text(
                    text = nombre.ifBlank { "marketero" },
                    color = BrandBlue,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }
        }
    }
}

private enum class AuthMode {
    Login,
    Register,
}

@Composable
private fun FieldLabel(text: String) {
    Text(
        text = text,
        color = Color(0xFF777A8A),
        fontSize = 12.sp,
        fontWeight = FontWeight.ExtraBold,
    )
}

@Composable
private fun StyledTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    leadingIcon: ImageVector,
    keyboardOptions: KeyboardOptions,
    modifier: Modifier = Modifier,
    keyboardActions: KeyboardActions = KeyboardActions.Default,
    trailingIcon: ImageVector? = null,
    onTrailingIconClick: (() -> Unit)? = null,
    visualTransformation: VisualTransformation = VisualTransformation.None,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        singleLine = true,
        placeholder = {
            Text(
                text = placeholder,
                color = Color(0xFFBCC0CD),
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
            )
        },
        leadingIcon = {
            Icon(
                imageVector = leadingIcon,
                contentDescription = null,
                tint = Color(0xFF9BA0B2),
                modifier = Modifier.size(20.dp),
            )
        },
        trailingIcon = trailingIcon?.let { icon ->
            {
                IconButton(onClick = { onTrailingIconClick?.invoke() }) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = Color(0xFF9BA0B2),
                        modifier = Modifier.size(20.dp),
                    )
                }
            }
        },
        visualTransformation = visualTransformation,
        keyboardOptions = keyboardOptions,
        keyboardActions = keyboardActions,
        shape = RoundedCornerShape(13.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = BrandBlue.copy(alpha = 0.7f),
            unfocusedBorderColor = FieldBorder,
            focusedContainerColor = Color.White,
            unfocusedContainerColor = Color.White,
            cursorColor = BrandBlue,
            focusedTextColor = TextDark,
            unfocusedTextColor = TextDark,
        ),
        modifier = modifier
            .fillMaxWidth()
            .height(58.dp),
    )
}

@Composable
private fun SecurityBadge(icon: ImageVector) {
    Box(
        modifier = Modifier
            .size(26.dp)
            .clip(CircleShape)
            .border(1.dp, Color(0xFFD3D6E3), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = TextMuted,
            modifier = Modifier.size(14.dp),
        )
    }
}
