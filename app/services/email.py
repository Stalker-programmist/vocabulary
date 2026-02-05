from __future__ import annotations

import smtplib
from email.message import EmailMessage

from ..settings import SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USER


def send_verification_email(to_email: str, code: str) -> None:
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD or not SMTP_FROM:
        raise RuntimeError("SMTP is not configured")

    message = EmailMessage()
    message["Subject"] = "Vocabulary verification code"
    message["From"] = SMTP_FROM
    message["To"] = to_email
    message.set_content(
        f"Your verification code is {code}. It expires in 10 minutes."
    )

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(message)
