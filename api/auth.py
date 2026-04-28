import os

import httpx
from fastapi import APIRouter, Cookie, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from db import User, get_db
from deps import create_access_token, create_refresh_token, decode_refresh_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

GITHUB_CLIENT_ID = os.environ["GITHUB_CLIENT_ID"]
GITHUB_CLIENT_SECRET = os.environ["GITHUB_CLIENT_SECRET"]
GOOGLE_CLIENT_ID = os.environ["GOOGLE_CLIENT_ID"]
GOOGLE_CLIENT_SECRET = os.environ["GOOGLE_CLIENT_SECRET"]
OAUTH_REDIRECT_BASE_URL = os.environ["OAUTH_REDIRECT_BASE_URL"]
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_URL = "https://api.github.com/user"
GITHUB_USER_EMAILS_URL = "https://api.github.com/user/emails"

GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"


def _set_auth_cookies(response: RedirectResponse, user_id: str) -> None:
    access = create_access_token(user_id)
    refresh = create_refresh_token(user_id)
    response.set_cookie(
        key="access_token",
        value=access,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
        max_age=60 * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/api/auth",
        max_age=7 * 24 * 60 * 60,
    )


def _clear_auth_cookies(response: RedirectResponse | dict) -> None:
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/api/auth")


def _get_or_create_user(db: Session, email: str, name: str, provider: str, avatar_url: str | None = None) -> User:
    user = db.query(User).filter(User.email == email, User.auth_provider == provider).first()
    if user is None:
        user = User(email=email, name=name, auth_provider=provider, avatar_url=avatar_url)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        if avatar_url and user.avatar_url != avatar_url:
            user.avatar_url = avatar_url
            db.commit()
    return user


# --- GitHub OAuth ---


@router.get("/github")
def github_login():
    params = f"client_id={GITHUB_CLIENT_ID}&redirect_uri={OAUTH_REDIRECT_BASE_URL}/api/auth/github/callback&scope=user:email"
    return RedirectResponse(url=f"{GITHUB_AUTHORIZE_URL}?{params}")


@router.get("/github/callback")
async def github_callback(code: str, db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GITHUB_TOKEN_URL,
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )

        if token_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to exchange code with GitHub")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="No access token from GitHub")

        auth_headers = {"Authorization": f"Bearer {access_token}"}

        user_resp = await client.get(GITHUB_USER_URL, headers=auth_headers)
        if user_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch GitHub user")

        user_data = user_resp.json()
        email = user_data.get("email")

        if not email:
            emails_resp = await client.get(GITHUB_USER_EMAILS_URL, headers=auth_headers)
            if emails_resp.status_code == 200:
                for entry in emails_resp.json():
                    if entry.get("primary") and entry.get("verified"):
                        email = entry["email"]
                        break

        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not retrieve email from GitHub")

        name = user_data.get("name") or user_data.get("login", "Unknown")
        avatar_url = user_data.get("avatar_url")

    user = _get_or_create_user(db, email=email, name=name, provider="github", avatar_url=avatar_url)

    response = RedirectResponse(url=FRONTEND_URL, status_code=302)
    _set_auth_cookies(response, str(user.id))
    return response


# --- Google OAuth ---


@router.get("/google")
def google_login():
    redirect_uri = f"{OAUTH_REDIRECT_BASE_URL}/api/auth/google/callback"
    params = (
        f"client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
        f"&scope=openid%20email%20profile"
        f"&access_type=offline"
    )
    return RedirectResponse(url=f"{GOOGLE_AUTHORIZE_URL}?{params}")


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    redirect_uri = f"{OAUTH_REDIRECT_BASE_URL}/api/auth/google/callback"

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            },
        )

        if token_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to exchange code with Google")

        token_data = token_resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="No access token from Google")

        user_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if user_resp.status_code != 200:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Failed to fetch Google user info")

        user_data = user_resp.json()
        email = user_data.get("email")
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not retrieve email from Google")

        name = user_data.get("name", "Unknown")
        avatar_url = user_data.get("picture")

    user = _get_or_create_user(db, email=email, name=name, provider="google", avatar_url=avatar_url)

    response = RedirectResponse(url=FRONTEND_URL, status_code=302)
    _set_auth_cookies(response, str(user.id))
    return response


# --- Common endpoints ---


@router.post("/logout")
def logout():
    response = RedirectResponse(url=FRONTEND_URL, status_code=302)
    _clear_auth_cookies(response)
    return response


@router.post("/refresh")
def refresh(refresh_token: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    if refresh_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    user_id = decode_refresh_token(refresh_token)
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    access = create_access_token(str(user.id))
    response = {"message": "Token refreshed"}
    from fastapi.responses import JSONResponse
    resp = JSONResponse(content=response)
    resp.set_cookie(
        key="access_token",
        value=access,
        httponly=True,
        samesite="lax",
        secure=False,
        path="/",
        max_age=60 * 60,
    )
    return resp


@router.get("/me")
def me(user: User = Depends(get_current_user)):
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "auth_provider": user.auth_provider,
        "avatar_url": user.avatar_url,
    }
