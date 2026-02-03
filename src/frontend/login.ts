// Glass verification proxy for frontend/src/pages/Login.tsx
// Glass spec: glass/frontend/login.glass

export class OAuthRedirectFailed extends Error {
  constructor(message = "OAuth redirect failed") {
    super(message);
    this.name = "OAuthRedirectFailed";
  }
}
