import unittest

from server import build_install_command, build_remove_command, normalize_skill, installed_skills


class ServerTests(unittest.TestCase):
    def test_installed_skills_returns_list(self):
        result = installed_skills()
        self.assertIsInstance(result, list)

    def test_github_install_command(self):
        command = build_install_command("vercel-labs/agent-skills", "find-skills")
        self.assertEqual(command, ["skills", "add", "vercel-labs/agent-skills", "--skill", "find-skills", "-g", "-y"])

    def test_well_known_install_command(self):
        command = build_install_command("agent.qq.com", "agently-mail", "well-known")
        self.assertEqual(command, ["skills", "add", "https://agent.qq.com/", "--skill", "agently-mail", "-g", "-y"])

    def test_remove_command(self):
        self.assertEqual(build_remove_command("find-skills"), ["skills", "remove", "find-skills", "-g", "-y"])

    def test_browser_skill_is_normalized(self):
        skill = normalize_skill({"name": "agent-browser", "skillId": "agent-browser", "source": "vercel-labs/agent-browser"})
        self.assertEqual(skill["id"], "vercel-labs/agent-browser/agent-browser")
        self.assertEqual(skill["url"], "https://www.skills.sh/vercel-labs/agent-browser")


if __name__ == "__main__":
    unittest.main()
