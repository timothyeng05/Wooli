# App Store Connect — App Privacy answers

App Store Connect → Wooli → **App Privacy** → Get Started.

1. **Do you or your third-party partners collect data from this app?** → **No, we do not collect data from this app.**
   - Apple counts data as "collected" only when it's sent off the device somewhere the developer (or a partner) can access it. Wooli has no servers, no analytics and no ads:
     - Trips and Eats sync through CloudKit to the **user's own private iCloud** database, which the developer can't read.
     - Bank data is downloaded by the phone **directly from SimpleFIN**, a service the user signs up for themselves. Nothing passes through the developer.
     - Budget, period and settings stay on the device.
2. The label will read **"Data Not Collected"**. Publish it.

**Privacy Policy URL** (App Information → Privacy Policy URL): `https://<your Vercel domain>/privacy` (the site in `app/`). Support URL: `/support`.

The app's `PrivacyInfo.xcprivacy` matches: no tracking, no collected data types, and UserDefaults with reason CA92.1, the app's own settings.
