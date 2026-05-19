from datetime import timedelta
import time

import requests
from flask import current_app

from app.extensions import db
from app.models.base import now_local
from app.models.cache import UserNameCache


DINGTALK_TOKEN_CACHE = {
    "token": None,
    "expires_at": 0,
}


class DingTalkClient:
    TOKEN_URL = "https://oapi.dingtalk.com/gettoken"
    MOBILE_TO_UID_URL = "https://oapi.dingtalk.com/topapi/v2/user/getbymobile"
    UID_TO_NAME_URL = "https://oapi.dingtalk.com/topapi/v2/user/get"

    def __init__(self):
        config = current_app.config
        self.appkey = config.get("DINGTALK_APPKEY")
        self.appsecret = config.get("DINGTALK_APPSECRET")
        self.timeout = 10

    @property
    def configured(self):
        return bool(self.appkey and self.appsecret)

    def get_name_by_mobile(self, mobile):
        if not mobile or mobile == "N/A":
            return None

        cached_name = self.get_cached_name(mobile)
        if cached_name:
            return cached_name

        if not self.configured:
            return None

        token = self.get_token()
        if not token:
            return None

        uid_response = requests.post(self.MOBILE_TO_UID_URL, params={
            "access_token": token,
            "mobile": mobile,
        }, timeout=self.timeout)
        uid_response.raise_for_status()
        uid_payload = uid_response.json()
        if uid_payload.get("errcode") != 0:
            return None

        user_id = uid_payload.get("result", {}).get("userid")
        if not user_id:
            return None

        name_response = requests.post(self.UID_TO_NAME_URL, params={
            "access_token": token,
            "userid": user_id,
        }, timeout=self.timeout)
        name_response.raise_for_status()
        name_payload = name_response.json()
        if name_payload.get("errcode") != 0:
            return None

        name = name_payload.get("result", {}).get("name")
        if name:
            upsert_name_cache(mobile, name)
        return name

    def get_cached_name(self, mobile):
        cached = UserNameCache.query.filter_by(mobile=mobile).first()
        if cached and not cached.is_expired():
            return cached.real_name
        return None

    def get_token(self):
        now = time.time()
        if DINGTALK_TOKEN_CACHE["token"] and DINGTALK_TOKEN_CACHE["expires_at"] > now:
            return DINGTALK_TOKEN_CACHE["token"]

        response = requests.get(self.TOKEN_URL, params={
            "appkey": self.appkey,
            "appsecret": self.appsecret,
        }, timeout=self.timeout)
        response.raise_for_status()
        payload = response.json()
        if payload.get("errcode") != 0:
            return None

        token = payload.get("access_token")
        if token:
            ttl = current_app.config.get("DINGTALK_TOKEN_TTL", 7000)
            DINGTALK_TOKEN_CACHE["token"] = token
            DINGTALK_TOKEN_CACHE["expires_at"] = now + max(60, ttl - 60)
        return token


def upsert_name_cache(mobile, name):
    cached = UserNameCache.query.filter_by(mobile=mobile).first()
    if not cached:
        cached = UserNameCache(mobile=mobile, real_name=name)
        db.session.add(cached)
    cached.real_name = name
    cached.expires_at = now_local() + timedelta(hours=24)
    cached.last_updated = now_local()
    db.session.commit()
