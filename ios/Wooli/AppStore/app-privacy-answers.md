# App Store Connect — App Privacy answers

App Store Connect → Wooli → **App Privacy** → Get Started.

1. **Do you or your third-party partners collect data from this app?** → **No, we do not collect data from this app.**
   - Apple counts data as "collected" only when it's sent off the device somewhere the developer (or a partner) can access it. Wooli has no servers, no analytics and no ads:
     - Trips and Eats sync through CloudKit to the **user's own private iCloud** database, which the developer can't read.
     - Bank data is downloaded by the phone **directly from SimpleFIN**, a service the user signs up for themselves. Nothing passes through the developer.
     - Budget syncs through the user's private iCloud too; settings stay on the device.
     - Periods and symptoms are read from and saved to **Apple Health** on the phone. Wooli keeps no copy, and they never reach the developer.
     - Reminders are read from and saved to **Apple Reminders** on the device. Wooli keeps no copy, and they never reach the developer.
     - Movies and Recipes sync the same way (private iCloud). Movie search calls the TMDB API (themoviedb.org), and sharing an Instagram reel makes the phone fetch that public post from Instagram — both requests go from the phone to those services, never to the developer. Place search falls back to Google Places when Apple Maps finds nothing (or on tap): the typed text and the trip's destination area go from the phone to Google, never the phone's location and never to the developer.
     - Near me in Eats reads the phone's location on demand, in the app. It's used on the phone only: never saved, synced or sent anywhere.
     - Category suggestions and reel/recipe parsing run on-device with Apple Intelligence (Foundation Models); nothing is sent off the phone.
2. The label will read **"Data Not Collected"**. Publish it.

**Privacy Policy URL** (App Information → Privacy Policy URL): `https://<your Vercel domain>/privacy` (the site in `app/`). Support URL: `/support`.

The app's `PrivacyInfo.xcprivacy` matches: no tracking, no collected data types, and UserDefaults with reason CA92.1, the app's own settings.
