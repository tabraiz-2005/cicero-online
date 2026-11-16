"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken } from "@/lib/api";
import { useApp } from "@/components/Shell";

export default function Login() {
  const router = useRouter();
  const { toast } = useApp();
  const [mode, setMode] = useState("supplier");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Cicero Online");

  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get("as");
    if (m === "owner") setMode("owner");
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = mode === "supplier" ? { username, password } : { password };
      const res = await api("/login", { method: "POST", body });
      setToken(res.token);
      router.replace(res.role === "supplier" ? "/portal" : "/");
    } catch (err) {
      toast(err.message, "err");
    }
    setBusy(false);
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="logo lg">C</div>
        <h1>{name}</h1>
        <div className="seg">
          <button type="button" className={mode === "supplier" ? "on" : ""} onClick={() => setMode("supplier")}>Supplier</button>
          <button type="button" className={mode === "owner" ? "on" : ""} onClick={() => setMode("owner")}>Owner</button>
        </div>
        <p>{mode === "supplier" ? "Log in to see your account" : "Owner login"}</p>
        {mode === "supplier" && (
          <input className="input big" placeholder="Username" value={username} autoCapitalize="none" autoCorrect="off"
            onChange={(e) => setUsername(e.target.value)} autoFocus required />
        )}
        <input className="input big" type="password" placeholder="Password" value={password}
          onChange={(e) => setPassword(e.target.value)} autoFocus={mode === "owner"} required={mode === "supplier"} />
        <button className="btn btn-primary btn-block" disabled={busy}>{busy ? "Checking…" : "Log in"}</button>
      </form>
    </div>
  );
}
