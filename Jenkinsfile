pipeline {
    agent any

    tools {
        nodejs 'nodejs'
    }

    environment {
        IMAGE_NAME = "anveshbv16/simple-devops-app"
    }

    stages {

        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }

        stage('SonarCloud Scan') {
            steps {

                script {

                    def scannerHome = tool 'sonar-scanner'

                    withCredentials([string(
                        credentialsId: 'sonar-token',
                        variable: 'SONAR_TOKEN'
                    )]) {

                        bat """
                        ${scannerHome}\\bin\\sonar-scanner.bat ^
                        -Dsonar.projectKey=anvesh1605_simple-devops-app ^
                        -Dsonar.organization=anvesh1605 ^
                        -Dsonar.sources=. ^
                        -Dsonar.host.url=https://sonarcloud.io ^
                        -Dsonar.login=%SONAR_TOKEN%
                        """
                    }
                }
            }
        }
        stage('Trivy Scan') {
            steps {

                bat '''
                "C:\\trivy.exe" fs ^
                --severity HIGH,CRITICAL ^
                .
                '''
            }
        }

        stage('Build Docker Image') {
            steps {
                bat 'docker build -t %IMAGE_NAME% .'
            }
        }


        stage('Push Docker Image') {
            steps {

                withCredentials([usernamePassword(
                    credentialsId: 'dockerhub',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )]) {

                    bat 'docker login -u %DOCKER_USER% -p %DOCKER_PASS%'
                    bat 'docker push %IMAGE_NAME%'
                }
            }
        }

        stage('Test') {
            steps {
                echo 'Sonar and Docker working'
            }
        }
    }
}