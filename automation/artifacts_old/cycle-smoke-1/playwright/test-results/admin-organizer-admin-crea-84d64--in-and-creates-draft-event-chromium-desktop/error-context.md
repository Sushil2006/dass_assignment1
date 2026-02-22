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
    - generic [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]: Email
        - textbox "Email" [ref=e17]:
          - /placeholder: you@example.com
      - generic [ref=e18]:
        - generic [ref=e19]: Password
        - textbox "Password" [ref=e20]:
          - /placeholder: "********"
      - generic [ref=e21]:
        - button "Sign in" [ref=e22] [cursor=pointer]
        - link "Create account" [ref=e23] [cursor=pointer]:
          - /url: /signup
```