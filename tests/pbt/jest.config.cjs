const path = require("path")
const root = path.resolve(__dirname, "../..")
const subject = process.env.PBT_SUBJECT_ROOT || root

module.exports = {
    rootDir: root,
    preset: "ts-jest",
    testEnvironment: "jsdom",
    testMatch: ["<rootDir>/tests/pbt/**/*.property.test.ts"],
    testTimeout: 120000,
    moduleNameMapper: {
        "^subject/(.*)$": `${subject}/packages/motion-dom/src/$1`,
        "^motion-utils$": `${subject}/packages/motion-utils/src/index.ts`,
    },
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: {
                    target: "ES2022",
                    useDefineForClassFields: false,
                    module: "commonjs",
                    esModuleInterop: true,
                    baseUrl: root,
                    paths: {
                        "subject/*": [`${subject}/packages/motion-dom/src/*`],
                        "motion-utils": [
                            `${subject}/packages/motion-utils/src/index.ts`,
                        ],
                    },
                },
            },
        ],
    },
}
