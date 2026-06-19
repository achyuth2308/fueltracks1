const bcrypt = require('bcryptjs');
const hash = '$2a$10$jIl/KMR9RSE1Acd83Hn2ZOkMq2BC59Ha2pCx8LyKCvPd5Gyt/6Hn6';
bcrypt.compare('password123', hash).then(res => {
  console.log("Is password123?", res);
});
