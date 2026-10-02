"""Authentication tests."""
def test_register_success(client):
    import uuid

    email = f"a_{uuid.uuid4().hex[:6]}@example.com"
    r = client.post(
        "/api/auth/register",
        json={"full_name": "Alice", "email": email, "password": "Password123!"},
    )
    assert r.status_code == 201
    data = r.json()
    assert "access_token" in data
    assert data["user"]["email"] == email


def test_register_duplicate_email(client):
    import uuid

    email = f"dup_{uuid.uuid4().hex[:6]}@example.com"
    body = {"full_name": "Bob", "email": email, "password": "Password123!"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    r = client.post("/api/auth/register", json=body)
    assert r.status_code == 400


def test_register_invalid_email(client):
    r = client.post(
        "/api/auth/register",
        json={"full_name": "X", "email": "not-an-email", "password": "Password123!"},
    )
    assert r.status_code == 422


def test_login_success(client):
    import uuid

    email = f"login_{uuid.uuid4().hex[:6]}@example.com"
    client.post(
        "/api/auth/register",
        json={"full_name": "Carol", "email": email, "password": "Password123!"},
    )
    r = client.post("/api/auth/login", json={"email": email, "password": "Password123!"})
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_login_wrong_password(client):
    import uuid

    email = f"wp_{uuid.uuid4().hex[:6]}@example.com"
    client.post(
        "/api/auth/register",
        json={"full_name": "Dave", "email": email, "password": "Password123!"},
    )
    r = client.post("/api/auth/login", json={"email": email, "password": "WrongPass!"})
    assert r.status_code == 401


def test_me_requires_auth(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_me_with_auth(auth_client):
    r = auth_client.get("/api/auth/me")
    assert r.status_code == 200
    assert "email" in r.json()