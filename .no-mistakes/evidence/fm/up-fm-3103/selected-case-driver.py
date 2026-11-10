from pathlib import Path
import re

root = Path.cwd()
source = root / 'tests/fm-pr-check-security.test.sh'
body = source.read_text()
# Preserve existing fixture functions and assertions. Only the top-level
# invocation list is replaced, so a failed unrelated fixture cannot prevent
# execution of the remaining supported-forge cases.
body = re.sub(r'^test_[A-Za-z0-9_]+(?: [^\n]*)?\n', '', body, flags=re.M)
body = body.replace('. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"',
                    '. "' + str(root / 'tests/lib.sh') + '"')
for name in ('test_forgejo_merge_watch', 'test_gerrit_merge_watch'):
    dest = root / '.tmp-up3103-072' / (name + '.test.sh')
    dest.write_text(body + '\nset -x\n' + name + '\n')
    print(dest)

body = (root / 'tests/fm-spawn-pool-base-freshen.test.sh').read_text()
body = re.sub(r'^test_[A-Za-z0-9_]+(?: [^\n]*)?\n', '', body, flags=re.M)
body = body.replace('. "$(dirname "${BASH_SOURCE[0]}")/fixtures.sh"',
                    '. "' + str(root / 'tests/fixtures.sh') + '"')
dest = root / '.tmp-up3103-072/selected-base-binding.test.sh'
dest.write_text(body + '\ntest_non_main_default_branch_refreshes_before_branching\n'
                + 'test_named_base_branch_starts_from_that_branch\n')
print(dest)
