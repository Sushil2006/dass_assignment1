# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - link "DASS" [ref=e5] [cursor=pointer]:
        - /url: /
      - button "Toggle navigation" [ref=e6] [cursor=pointer]
  - generic [ref=e10]:
    - generic [ref=e11]: Login
    - generic [ref=e12]:
      - generic [ref=e13]:
        - generic [ref=e14]: Email
        - textbox "Email" [ref=e15]:
          - /placeholder: you@example.com
      - generic [ref=e16]:
        - generic [ref=e17]: Password
        - textbox "Password" [ref=e18]:
          - /placeholder: "********"
      - generic [ref=e19]:
        - button "Sign in" [ref=e20] [cursor=pointer]
        - link "Create account" [ref=e21] [cursor=pointer]:
          - /url: /signup
```