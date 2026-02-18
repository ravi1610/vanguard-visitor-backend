import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // Graceful shutdown — let Prisma disconnect cleanly on SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Security headers
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const allowedOrigins = configService.get<string[]>('cors.origins');
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global API prefix — all routes become /api/* except health check
  app.setGlobalPrefix('api', { exclude: ['health'] });

  // Serve uploaded files
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads/' });

  const config = new DocumentBuilder()
    .setTitle('Vanguard Visitor API')
    .setDescription(
      'Vanguard Visitor — multi-tenant property management platform API (vanguardvisitor.com). ' +
      'Provides endpoints for visitor tracking, resident management, staff directory, vehicle registry, ' +
      'maintenance work orders, project management, calendar events, document storage, compliance tracking, ' +
      'and vendor management.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'Enter JWT token' },
      'JWT',
    )
    .addTag('Auth', 'Authentication endpoints')
    .addTag('Tenants', 'Tenant (property/community) management')
    .addTag('Users', 'System user management and role assignment')
    .addTag('Roles', 'Role-based access control')
    .addTag('Visitors', 'Visitor registry')
    .addTag('Visits', 'Visit check-in / check-out tracking')
    .addTag('Staff', 'Staff directory management')
    .addTag('Vehicles', 'Vehicle registry')
    .addTag('Spaces', 'Space and parking management')
    .addTag('Space Assignments', 'Space assignment scheduling')
    .addTag('Maintenance', 'Maintenance / work order tracking')
    .addTag('Projects', 'Project management')
    .addTag('Tasks', 'Task management within projects')
    .addTag('Calendar', 'Calendar event management')
    .addTag('Documents', 'Document management')
    .addTag('Compliance', 'Compliance tracking')
    .addTag('Vendors', 'Vendor / contractor management')
    .addTag('Reports', 'Reporting and analytics')
    .addTag('BOLOs', 'Be On the Lookout alerts management')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Vanguard Visitor API Docs',
    customCss: '.swagger-ui .topbar { display: none }',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap().catch((err) => {
  console.error('❌ Error starting application:', err);
  process.exit(1);
});
