import pytest

def test_get_sites_empty_or_default(client, staff_headers):
    response = client.get("/sites/", headers=staff_headers)
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert data[0]["name"] == "Main Site"

def test_create_site_as_manager(client, manager_headers):
    payload = {
        "name": "South Port Terminal",
        "location": "South Dock Zone B",
        "code": "SP_TERM",
        "status": "ACTIVE"
    }
    response = client.post("/sites/", json=payload, headers=manager_headers)
    assert response.status_code == 201
    data = response.json()
    assert data["id"] is not None
    assert data["name"] == "South Port Terminal"
    assert data["location"] == "South Dock Zone B"
    assert data["code"] == "SP_TERM"
    assert data["status"] == "ACTIVE"

def test_create_site_as_staff_forbidden(client, staff_headers):
    payload = {
        "name": "Unauthorized Site",
        "location": "Loc",
        "code": "UNAUTH"
    }
    response = client.post("/sites/", json=payload, headers=staff_headers)
    assert response.status_code == 403

def test_create_duplicate_site_name(client, manager_headers):
    payload = {
        "name": "Main Site", # Already exists from default seed
        "location": "Somewhere",
        "code": "MAIN_DUP"
    }
    response = client.post("/sites/", json=payload, headers=manager_headers)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_create_duplicate_site_code(client, manager_headers):
    payload = {
        "name": "Distinct Site Name",
        "location": "Somewhere",
        "code": "MAIN" # Matches MAIN code of site 1
    }
    response = client.post("/sites/", json=payload, headers=manager_headers)
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]

def test_get_site_by_id(client, staff_headers):
    response = client.get("/sites/1", headers=staff_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1
    assert data["name"] == "Main Site"

def test_get_site_by_id_not_found(client, staff_headers):
    response = client.get("/sites/9999", headers=staff_headers)
    assert response.status_code == 404

def test_update_site(client, manager_headers):
    payload = {
        "location": "Updated HQ Address"
    }
    response = client.patch("/sites/1", json=payload, headers=manager_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["location"] == "Updated HQ Address"
