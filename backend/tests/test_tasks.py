"""Task CRUD tests."""


def test_create_task(auth_client):
    r = auth_client.post(
        "/api/tasks",
        json={
            "title": "Write tests",
            "description": "Pytest tests for Taskora",
            "priority": "high",
            "status": "todo",
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["title"] == "Write tests"
    assert data["priority"] == "high"


def test_list_tasks(auth_client):
    auth_client.post("/api/tasks", json={"title": "T1", "priority": "low"})
    auth_client.post("/api/tasks", json={"title": "T2", "priority": "urgent"})
    r = auth_client.get("/api/tasks")
    assert r.status_code == 200
    assert len(r.json()) >= 2


def test_get_task_by_id(auth_client):
    created = auth_client.post("/api/tasks", json={"title": "Detail me"}).json()
    r = auth_client.get(f"/api/tasks/{created['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == created["id"]


def test_update_task(auth_client):
    created = auth_client.post("/api/tasks", json={"title": "Old"}).json()
    r = auth_client.put(
        f"/api/tasks/{created['id']}",
        json={"title": "New", "priority": "urgent", "status": "in_progress"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "New"
    assert r.json()["priority"] == "urgent"
    assert r.json()["status"] == "in_progress"


def test_update_status(auth_client):
    created = auth_client.post("/api/tasks", json={"title": "Done soon"}).json()
    r = auth_client.patch(f"/api/tasks/{created['id']}/status", json={"status": "completed"})
    assert r.status_code == 200
    assert r.json()["status"] == "completed"
    assert r.json()["completed_at"] is not None


def test_delete_task(auth_client):
    created = auth_client.post("/api/tasks", json={"title": "Temp"}).json()
    r = auth_client.delete(f"/api/tasks/{created['id']}")
    assert r.status_code == 204
    r2 = auth_client.get(f"/api/tasks/{created['id']}")
    assert r2.status_code == 404


def test_unauthorized_task_access(client):
    import uuid

    def register():
        email = f"u_{uuid.uuid4().hex[:6]}@example.com"
        return client.post(
            "/api/auth/register",
            json={"full_name": "U", "email": email, "password": "Password123!"},
        ).json()["access_token"]

    t1 = register()
    t2 = register()

    # user1 creates a task
    r = client.post(
        "/api/tasks",
        headers={"Authorization": f"Bearer {t1}"},
        json={"title": "Private"},
    )
    task_id = r.json()["id"]

    # user2 tries to access it
    r2 = client.get(f"/api/tasks/{task_id}", headers={"Authorization": f"Bearer {t2}"})
    assert r2.status_code == 404


def test_invalid_task_input(auth_client):
    r = auth_client.post("/api/tasks", json={"title": ""})
    assert r.status_code == 422


def test_stats(auth_client):
    auth_client.post("/api/tasks", json={"title": "S1", "status": "todo"})
    auth_client.post("/api/tasks", json={"title": "S2", "status": "completed"})
    r = auth_client.get("/api/tasks/stats")
    assert r.status_code == 200
    assert r.json()["total"] >= 2
    assert "completed" in r.json()