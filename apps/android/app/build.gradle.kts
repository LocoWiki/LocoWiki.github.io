plugins {
    id("com.android.application")
}

val releaseKeystore = System.getenv("LOCOWIKI_KEYSTORE")
val releaseKeystorePassword = System.getenv("LOCOWIKI_KEYSTORE_PASSWORD")
val releaseKeyAlias = System.getenv("LOCOWIKI_KEY_ALIAS")
val releaseKeyPassword = System.getenv("LOCOWIKI_KEY_PASSWORD")
val releaseSigningReady = !releaseKeystore.isNullOrBlank()
        && !releaseKeystorePassword.isNullOrBlank()
        && !releaseKeyAlias.isNullOrBlank()
        && !releaseKeyPassword.isNullOrBlank()

android {
    namespace = "com.locowiki.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.locowiki.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        resourceConfigurations += listOf("zh", "en")
    }

    signingConfigs {
        if (releaseSigningReady) {
            create("release") {
                storeFile = file(releaseKeystore!!)
                storePassword = releaseKeystorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (releaseSigningReady) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        resources.excludes += setOf("META-INF/*.kotlin_module")
    }
}

dependencies {
    // Intentionally dependency-free: the app is a thin WebView shell.
}
