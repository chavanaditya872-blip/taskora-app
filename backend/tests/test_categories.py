"""Category tests."""


def test_default_categories_seeded(auth_client):
    r = auth_client.get("/api/categories")
    assert r.status_code == 200
    names = {c["name"] for c in r.json()}
    assert "Work" in names
    assert "Personal" in names


def test_create_category(auth_client):
    r = auth_client.post("/api/categories", json={"name": "Errands"})
    assert r.status_code == 201
    assert r.json()["name"] == "Errands"


def test_duplicate_category(auth_client):
    auth_client.post("/api/categories", json={"name": "Unique"})
    r = auth_client.post("/api/categories", json={"name": "Unique"})
    assert r.status_code == 400