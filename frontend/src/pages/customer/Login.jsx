function Login() {
  return (
    <div className="page-container">
      <div className="card" style={{ maxWidth: "500px", margin: "0 auto" }}>
        <h1>Login</h1>
        <p>Masuk untuk mengakses keranjang dan riwayat booking Anda.</p>
        <div className="settings-form">
          <div className="field-group">
            <label>Email</label>
            <input type="email" placeholder="you@example.com" />
          </div>
          <div className="field-group">
            <label>Password</label>
            <input type="password" placeholder="••••••••" />
          </div>
          <button className="primary-button" type="button">Masuk</button>
        </div>
      </div>
    </div>
  );
}

export default Login;
