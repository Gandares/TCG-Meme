import { useState } from "react";
import { login, register } from "../api/cards";

export function AuthView({ onAuthenticated }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const auth = mode === "login" ? await login(username, password) : await register(username, password);
      onAuthenticated(auth);
    } catch (authError) {
      setError(authError.message || "No se pudo autenticar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-screen">
      <form className="auth-panel" onSubmit={handleSubmit}>
        <div>
          <h1>TCG Meme</h1>
          <p>{mode === "login" ? "Entra para ver tu coleccion." : "Crea un usuario para empezar tu coleccion."}</p>
        </div>

        <label>
          Usuario
          <input type="text" maxLength="24" required value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label>
          Contrasena
          <input type="password" minLength="4" required value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>

        {error ? <div className="form-error" role="alert">{error}</div> : null}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Procesando..." : mode === "login" ? "Entrar" : "Crear usuario"}
        </button>
        <button className="ghost-button" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Crear cuenta" : "Ya tengo cuenta"}
        </button>
      </form>
    </main>
  );
}
