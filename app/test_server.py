import unittest

from server import installed_skills


class ServerTests(unittest.TestCase):
    def test_installed_skills_returns_list(self):
        result = installed_skills()
        self.assertIsInstance(result, list)


if __name__ == "__main__":
    unittest.main()
