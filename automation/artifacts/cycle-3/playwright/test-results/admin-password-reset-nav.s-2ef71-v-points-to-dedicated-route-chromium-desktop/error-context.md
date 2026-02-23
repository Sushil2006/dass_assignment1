# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - link "DASS" [ref=e5] [cursor=pointer]:
        - /url: /
      - generic [ref=e7]:
        - link "Login" [ref=e8] [cursor=pointer]:
          - /url: /login
        - link "Participant Signup" [ref=e9] [cursor=pointer]:
          - /url: /signup
  - generic [ref=e12]:
    - generic [ref=e13]: Login
    - alert [ref=e14]: Failed to fetch
    - generic [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e17]: Email
        - textbox "Email" [ref=e18]:
          - /placeholder: you@example.com
          - text: admin@iiit.ac.in
      - generic [ref=e19]:
        - generic [ref=e20]: Password
        - textbox "Password" [ref=e21]:
          - /placeholder: "********"
          - text: admin123
      - generic [ref=e22]:
        - button "Sign in" [ref=e23] [cursor=pointer]
        - link "Create account" [ref=e24] [cursor=pointer]:
          - /url: /signup
```