# What we found in C:\Users\Administrator\Desktop\Skills Browser v1\skills-browser.exe

skills-browser.exe is a program for Windows, built for x86_64 (64-bit). Its internal names were removed (stripped), so most functions will have generated names.

Evidence ev_9dcd0f87fadde8932455d1aec0c99151d4c1ff27de44419fa8040ff32500bac7.

```json
{
  "architecture": "x86_64",
  "bits": 64,
  "dotnet_arch": null,
  "entry_point": "0x140011ad0",
  "format": "pe",
  "format_name": "PE (Windows)",
  "kind": "executable",
  "libraries": [
    "ADVAPI32.dll",
    "KERNEL32.dll",
    "SHELL32.dll",
    "USER32.dll",
    "api-ms-win-crt-convert-l1-1-0.dll",
    "api-ms-win-crt-heap-l1-1-0.dll",
    "api-ms-win-crt-locale-l1-1-0.dll",
    "api-ms-win-crt-math-l1-1-0.dll",
    "api-ms-win-crt-runtime-l1-1-0.dll",
    "api-ms-win-crt-stdio-l1-1-0.dll",
    "api-ms-win-crt-string-l1-1-0.dll",
    "api-ms-win-crt-time-l1-1-0.dll"
  ],
  "next_steps": [
    {
      "tool": "core_overview_show",
      "why": "a one-page summary: sections, imports, counts"
    },
    {
      "tool": "native_functions_list",
      "why": "every function we found"
    },
    {
      "tool": "native_strings_find",
      "why": "find text the program shows or uses"
    },
    {
      "tool": "native_function_study",
      "why": "a full dossier on one function (start with main or the entry point)"
    },
    {
      "tool": "core_feature_find",
      "why": "follow a word you see in the app to the code behind it"
    },
    {
      "tool": "native_pe_resources_list",
      "why": "icons, version information and the manifest"
    }
  ],
  "operating_system": "Windows",
  "plain_english": "skills-browser.exe is a program for Windows, built for x86_64 (64-bit). Its internal names were removed (stripped), so most functions will have generated names.",
  "recommended_toolsets": [
    "core",
    "native",
    "formats"
  ],
  "stripped": true,
  "symbol_table_stripped": true,
  "toolchain_hints": [
    {
      "category": "compiler",
      "evidence": "Rich header",
      "id": "msvc",
      "label": "Microsoft Visual C++ toolchain",
      "strength": "strong"
    }
  ]
}
```

## Ghidra

Deep mode: Ghidra has analysed C:\Users\Administrator\Desktop\Skills Browser v1\skills-browser.exe (1 min), so decompiling it is quick.
