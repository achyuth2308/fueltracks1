# FuelTracks — Complete Deployment Cookbook (GitHub → Live)

Follow this top to bottom. Each part builds on the one before. Don't skip
around. Simple language on purpose — if something feels unclear, it's in
the FAQ at the end.

---

# PART 1: FINISH THE TWO SERVERS

## Relay server (fix from where you left off)
1. Go back to **Type**
2. Click **"Shared Resources"** tab (not Dedicated)
3. Pick **CPX11** (smallest one)
4. Go to **Location** → now **Singapore** will be clickable → pick it
5. **Image** → Ubuntu **24.04** (not 26.04)
6. SSH Key → select `fueltracks-admin`
7. Name → `fueltracks-relay`
8. Click **Create & Buy now**
9. Copy the IP address shown → save it as **RELAY IP**

## Backend server (make this one too)
1. Click **Add Server** again
2. **Shared Resources** tab → pick **CPX31** (bigger one, ~8GB RAM)
3. **Location** → Singapore
4. **Image** → Ubuntu 24.04
5. SSH Key → `fueltracks-admin`
6. Name → `fueltracks-backend`
7. Click **Create & Buy now**
8. Copy the IP → save it as **BACKEND IP**

You should now have:
```
RELAY IP:    _______________
BACKEND IP:  _______________
```

---

# PART 2: SET UP AWS S3 + GLACIER (for old data storage)

This is a one-time setup in your web browser, on AWS's website.

## 2.1 Make an AWS account (skip if you have one)
Go to aws.amazon.com → Create an account → add a card (AWS needs one, but
what we're using costs almost nothing — a few rupees a month).

## 2.2 Create two storage buckets
1. In AWS Console, search for **"S3"** at the top, click it
2. Click **"Create bucket"**
3. Bucket name: `fueltracks-backups` (must be globally unique — add your
   name/numbers if taken, like `fueltracks-backups-achyuth`)
4. Region: pick **Asia Pacific (Singapore) ap-southeast-1** (matches your servers)
5. Leave everything else default → **Create bucket**
6. Repeat this again for a second bucket: `fueltracks-archive`

## 2.3 Set up the automatic Glacier rule (for the archive bucket only)
1. Click into the **`fueltracks-archive`** bucket
2. Click the **"Management"** tab
3. Click **"Create lifecycle rule"**
4. Rule name: `move-to-glacier`
5. Rule scope: "Apply to all objects in the bucket"
6. Under **"Lifecycle rule actions"**, check:
   **"Move current versions of objects between storage classes"**
7. Add a transition: **30 days** → **Glacier Deep Archive**
8. Save

This means: anything you upload to this bucket automatically gets moved to
super-cheap storage after 30 days, with zero extra work from you.

## 2.4 Create an access key (so your server can upload files here)
1. Search for **"IAM"** in AWS Console
2. Click **"Users"** → **"Create user"**
3. Name: `fueltracks-server`
4. Click through without adding to a group yet → create the user
5. Click into the new user → **"Add permissions"** → **"Attach policies
   directly"**
6. Search for and check: **`AmazonS3FullAccess`**
   *(Simple for now — this gives access to all your S3 buckets, not just
   these two. Fine at your current stage, worth tightening later — see FAQ.)*
7. Go to the **"Security credentials"** tab for this user
8. Click **"Create access key"** → choose **"Application running outside AWS"**
9. **Copy both values shown — you only see the secret one ONCE:**
   ```
   Access Key ID:     _______________
   Secret Access Key: _______________
   ```
   Save these somewhere safe (a password manager, not a random text file).

---

# PART 3: PROVISION BOTH SERVERS

## 3.1 Connect to the relay server
On your own laptop, open a terminal:
```bash
ssh root@<RELAY_IP>
```
Type `yes` if asked about a fingerprint.

## 3.2 Get your provisioning script onto the relay
Still on your laptop, in a **new terminal window** (keep the SSH one open):
```bash
scp infrastructure/relay_provision.sh root@<RELAY_IP>:~/
```

## 3.3 Run it (back in the SSH terminal, on the relay)
```bash
chmod +x relay_provision.sh
./relay_provision.sh <BACKEND_IP>
```
Wait for it to finish. Then check:
```bash
supervisorctl status
```
You should see 5 lines, all saying `RUNNING`.

Then:
```bash
ufw enable
```
Type `y` to confirm.

## 3.4 Connect to the backend server
New terminal on your laptop:
```bash
ssh root@<BACKEND_IP>
```

## 3.5 Get the script onto it
Another terminal on your laptop:
```bash
scp infrastructure/backend_provision.sh root@<BACKEND_IP>:~/
```

## 3.6 Find your own IP (needed for the firewall)
On your laptop:
```bash
curl ifconfig.me
```
This prints your current IP. Save it as **ADMIN IP**.

## 3.7 Run the backend script
Back in the SSH terminal (on the backend server):
```bash
chmod +x backend_provision.sh
./backend_provision.sh <RELAY_IP> <ADMIN_IP>
```
Wait for it to finish, then check:
```bash
sudo -u postgres psql -c '\l'
```
You should see `fueltracks` in the list.
```bash
redis-cli ping
```
Should say `PONG`.

**IMPORTANT — before running `ufw enable`:**
Open a brand new terminal window and try SSHing in again:
```bash
ssh root@<BACKEND_IP>
```
If that works, go back to your first terminal and run:
```bash
ufw enable
```
(This way, if something's wrong, you still have one working connection to
fix it — never close your only open session before confirming a new one works.)

## 3.8 Save the generated database password
```bash
cat /home/fueltracks/.db_credentials
```
Copy this password somewhere safe — you'll need it in Part 4.

---

# PART 4: DEPLOY YOUR CODE

All of this happens **on the backend server**, logged in as the `fueltracks`
user (not root).

## 4.1 Switch to the app user
```bash
su - fueltracks
```

## 4.2 Get your code from GitHub
```bash
git clone https://github.com/achyuth2308/fueltracks1.git app
cd app
```

## 4.3 Install everything
```bash
npm install --production
npm --prefix frontend install
npm run build:frontend
```

## 4.4 Set up your real environment file
```bash
cp .env.example .env
nano .env
```
Fill in real values:
```
DB_PASS=<the password from Part 3.8>
JWT_SECRET=<run: openssl rand -hex 64, paste the output>
API_PORT=3001
CORS_ORIGIN=https://app.fueltracks.in
NODE_ENV=production
DB_NAME=fueltracks

# S3 / Glacier — from Part 2.4
AWS_ACCESS_KEY_ID=<from Part 2.4>
AWS_SECRET_ACCESS_KEY=<from Part 2.4>
AWS_REGION=ap-southeast-1
S3_BACKUP_BUCKET=fueltracks-backups
S3_ARCHIVE_BUCKET=fueltracks-archive
```
Save and exit (in nano: `Ctrl+O`, Enter, `Ctrl+X`)

## 4.5 IMPORTANT — fix the two known bugs before going further

**Fix the DB name typo:**
```bash
nano scripts/runMigrations.js
```
Find the line with `'fueltracks1'` → change it to `'fueltracks'` → save.

**Fix nginx.conf** (we'll use this file in Part 5):
```bash
nano infrastructure/nginx.conf
```
Find `$proxy_addrs` → change to `$proxy_add_x_forwarded_for`
Find `127.0.0.1:3000` → change to `127.0.0.1:3001` (matching API_PORT above)
Save.

## 4.6 Set up the database
```bash
npm run db:init
npm run db:migrate
sudo -u postgres psql -d fueltracks -f database/timescale_migration.sql
npm run change-passwords
```

## 4.7 Verify the fix worked
```bash
psql -d fueltracks -c "\d raw_packets"
```
You should see `packet_type`, `device_time`, `odometer`, `raw_hex`,
`parsed_data` in the list. If they're there, the Sensor Logs bug is fixed.

## 4.8 Start the app
```bash
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```
It will print a command starting with `sudo env PATH=...` — copy that
entire line, paste it, run it. This makes the app restart automatically if
the server reboots.

Check it's running:
```bash
pm2 status
```
You should see both `fueltracks-api` and `fueltracks-tcp` as `online`.

---

# PART 5: DOMAIN + NGINX + SSL

## 5.1 Point your domain at the backend
Go to wherever you bought `fueltracks.in` (or wherever DNS is managed).
Add/edit an **A record**:
```
Name: app
Type: A
Value: <BACKEND_IP>
```
This makes `app.fueltracks.in` point to your server. Can take up to an hour
to work, sometimes just minutes.

## 5.2 Set up nginx
Back in your SSH session (as `fueltracks` user, or switch to root for this part):
```bash
exit    # back to root, if you were on the fueltracks user
sudo cp /home/fueltracks/app/infrastructure/nginx.conf /etc/nginx/sites-available/fueltracks
sudo ln -s /etc/nginx/sites-available/fueltracks /etc/nginx/sites-enabled/
sudo nginx -t
```
If it says "test successful," continue. If it shows an error, re-check
Part 4.5's fixes were saved correctly.
```bash
sudo systemctl reload nginx
```

## 5.3 Get a free SSL certificate
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d app.fueltracks.in
```
Follow the prompts (enter your email, agree to terms). It will
automatically set up HTTPS.

Test it renews correctly:
```bash
sudo certbot renew --dry-run
```

---

# PART 6: BACKUPS + ARCHIVAL (using the S3 buckets from Part 2)

## 6.1 Install the AWS command-line tool
```bash
sudo apt-get install -y awscli
aws configure
```
It will ask for 4 things:
```
AWS Access Key ID: <from Part 2.4>
AWS Secret Access Key: <from Part 2.4>
Default region: ap-southeast-1
Default output format: (just press Enter)
```

## 6.2 Set up the automatic daily jobs
```bash
su - fueltracks
crontab -e
```
Add these two lines at the bottom:
```
0 3 * * * /home/fueltracks/app/infrastructure/backup_script.sh
5 0 * * * /home/fueltracks/app/infrastructure/archival_script.sh
```
Save and exit.

## 6.3 Test them right now (don't wait until 3am to find out if they work)
```bash
bash /home/fueltracks/app/infrastructure/backup_script.sh
cat /var/log/fueltracks_backup.log
```
You should see "Backup successful" and "Uploaded to S3 successfully."

Go check the AWS S3 console → `fueltracks-backups` bucket → you should see
a `.dump` file sitting there.

---

# PART 7: GO LIVE — FINAL CHECKS

Do these in order. Don't skip to real devices until each one passes.

```
[ ] Visit https://app.fueltracks.in in a browser — loads with a lock icon (SSL working)
[ ] pm2 status shows both processes "online"
[ ] Backup test (Part 6.3) succeeded and file appears in S3
[ ] Run a device simulator (npm run sim:concox) — data shows up on the 
    live map
[ ] Point ONE real physical device at the RELAY's IP
[ ] Confirm that device's data shows up correctly, alerts fire correctly
[ ] Only after that one device works — migrate the rest of your fleet
[ ] Set up UptimeRobot.com (free) pointed at https://app.fueltracks.in/health
```

---

# PART 8: FAQ — DOUBTS YOU MIGHT HAVE

**Q: SSH says "Permission denied" — what do I do?**
A: You're probably trying to log in before the SSH key finished being
attached, or using the wrong key file. Try: `ssh -i ~/.ssh/id_ed25519 root@<IP>`
explicitly.

**Q: I ran `ufw enable` and now I can't connect at all — help!**
A: This is exactly why Part 3.7 tells you to test a second connection
first. If you're locked out: Hetzner Console → click your server → there's
a **"Console"** tab that gives you browser-based access even without SSH —
use that to fix the firewall rule (`ufw allow from <YOUR_REAL_IP> to any port 22`).

**Q: `nginx -t` shows an error — what now?**
A: It will tell you the exact line number of the problem. Almost always
this means Part 4.5's edits weren't saved correctly — re-open the file and
check.

**Q: How do I know the backup is actually going to Glacier, not just S3?**
A: Nothing moves to Glacier for 30 days (that's the rule we set in Part
2.3) — during that time it just sits in normal S3, which is correct and
expected. Check back after a month, or just trust the lifecycle rule — AWS
handles this automatically once it's set up.

**Q: Is `AmazonS3FullAccess` safe?**
A: It's fine for now — it means this specific access key can read/write to
any S3 bucket in your AWS account, not just these two. Since you likely
don't have other sensitive buckets yet, this is a reasonable simplification.
Later, you can tighten it to only allow access to `fueltracks-backups` and
`fueltracks-archive` specifically — ask when you're ready and I'll walk you
through a tighter policy.

**Q: My teammate needs access — what do I do?**
A: Covered in the earlier doc — they generate their own SSH key, send you
the public half, you add it to `authorized_keys` on the server, and you add
their IP to the firewall rule.

**Q: A device stopped sending data after I deployed — is this normal?**
A: Check: is the device pointed at the **RELAY's** IP, not the backend's
directly? Check `supervisorctl status` on the relay — are all 5 forwarders
still `RUNNING`? If yes to both, check the backend's logs:
`pm2 logs fueltracks-tcp`.

**Q: How do I update the code later, after making changes?**
A:
```bash
ssh root@<BACKEND_IP>
su - fueltracks
cd app
git pull origin main
npm ci --production
pm2 reload ecosystem.config.js --env production
```

**Q: Something feels broken and I don't know what — where do I look first?**
A: In this order:
```bash
pm2 status              # are both processes online?
pm2 logs                # what's the most recent error?
sudo systemctl status nginx    # is nginx running?
redis-cli ping           # is Redis alive?
sudo -u postgres psql -c '\l'  # is the database reachable?
```
Whatever's failing in this list is almost always where the real problem is.

**Q: I'm overwhelmed and don't know if I did everything right — what do I do?**
A: Come back with exactly where you are (which Part, which step) and what
you're seeing on screen — a screenshot or the exact error text. We'll fix
it one piece at a time, same as we've been doing. You don't need to hold
the whole system in your head at once — just the step you're on right now.
